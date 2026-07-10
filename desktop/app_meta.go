package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"

	"gaeaW/internal/agent"
	"gaeaW/internal/boot"
	"gaeaW/internal/config"
	"gaeaW/internal/control"
	"gaeaW/internal/costdb"
	"gaeaW/internal/i18n"
	"gaeaW/internal/knowledge"
	"gaeaW/internal/memory"
	"gaeaW/internal/provider"
	"gaeaW/internal/provider/xai"
)

// ContextInfo is the prompt-vs-window gauge payload. Both zero means no data yet.
// ContextInfo is the prompt-vs-window gauge payload. Both zero means no data yet.
// PlannerUsed/PlannerWindow track the Hermes model independently.
type ContextInfo struct {
	Used          int `json:"used"`
	Window        int `json:"window"`
	PlannerUsed   int `json:"plannerUsed"`
	PlannerWindow int `json:"plannerWindow"`
}

// BalanceInfo is the wallet-balance readout for the status bar. Available is true
// only when a balance was fetched; Display is the formatted amount (e.g. "¥110.00")
// and is "" when the active provider declares no balance_url — the frontend then
// omits the readout. Err carries a fetch failure for an optional tooltip.
type BalanceInfo struct {
	Available bool   `json:"available"`
	Display   string `json:"display"`
	Err       string `json:"err,omitempty"`
}

// JobView is one running background job (bash/task started with
// run_in_background) for the status-bar indicator.
type JobView struct {
	ID        string `json:"id"`
	Kind      string `json:"kind"`
	Label     string `json:"label"`
	Status    string `json:"status"`
	StartedAt int64  `json:"startedAt"`
}

// Meta describes the session for the frontend's header and status line.
type Meta struct {
	Label          string `json:"label"`
	SubagentLabel  string `json:"subagentLabel,omitempty"`
	PlannerLabel   string `json:"plannerLabel,omitempty"`   // V10.31: planner model label for stats
	Ready          bool   `json:"ready"`
	StartupErr   string `json:"startupErr,omitempty"`
	EventChannel string `json:"eventChannel"`
	Cwd          string `json:"cwd"`
	Bypass       bool   `json:"bypass"`     // YOLO mode on (auto-approve every tool call)
	PermLevel    string `json:"permLevel"`  // "ask"|"auto"|"yolo"
}
// CommandInfo describes one available slash command for the composer's "/" menu.
type CommandInfo struct {
	Name        string `json:"name"` // without the leading slash
	Description string `json:"description"`
	Hint        string `json:"hint,omitempty"` // argument hint, if any
	Kind        string `json:"kind"`           // "builtin" | "custom" | "mcp"
}

// SlashArgItem is one sub-command / argument suggestion for the composer's slash
// menu (the part after the command word). Mirrors the CLI's arg completion via
// the shared control.SlashArgItems, so desktop and CLI offer the same hints.
type SlashArgItem struct {
	Label   string `json:"label"`
	Insert  string `json:"insert"`
	Hint    string `json:"hint"`
	Descend bool   `json:"descend"`
}

// SlashArgsResult carries the suggestions plus the byte offset in the input where
// the current token begins, so the composer replaces just that token.
type SlashArgsResult struct {
	Items []SlashArgItem `json:"items"`
	From  int            `json:"from"`
}

// ModelInfo is one (provider, model) the bottom switcher can pick. Ref ("provider/
// model") is what SetModel takes; Provider/Model are for display.
type ModelInfo struct {
	Ref      string `json:"ref"`
	Provider string `json:"provider"`
	Model    string `json:"model"`
	Current  bool   `json:"current"`
}

// MemoryDoc is one loaded doc-memory file for the panel: path, scope, and body.
type MemoryDoc struct {
	Path  string `json:"path"`
	Scope string `json:"scope"`
	Body  string `json:"body"`
}

// MemoryFact is one saved auto-memory, surfaced read-only in the panel.
type MemoryFact struct {
	Name        string `json:"name"`
	Title       string `json:"title,omitempty"`
	Description string `json:"description"`
	Type        string `json:"type"`
	Body        string `json:"body"`
}

// MemoryScope is one writable quick-add target (scope id + the file it writes to).
type MemoryScope struct {
	Scope string `json:"scope"`
	Path  string `json:"path"`
}

// MemoryView is the whole memory panel payload: hierarchical docs, saved facts,
// and the writable scopes for the quick-add selector.
type MemoryView struct {
	Docs      []MemoryDoc   `json:"docs"`
	Facts     []MemoryFact  `json:"facts"`
	Scopes    []MemoryScope `json:"scopes"`
	StoreDir  string        `json:"storeDir"`
	Available bool          `json:"available"`
}

// writableScopes are the quick-add targets the panel offers, broad → specific.
var writableScopes = []memory.Scope{memory.ScopeUser, memory.ScopeProject, memory.ScopeLocal}

// ContextUsage returns the latest context-window gauge numbers.
func (a *App) ContextUsage() ContextInfo {
	a.mu.RLock()
	ctrl := a.ctrl
	a.mu.RUnlock()
	if ctrl == nil {
		return ContextInfo{}
	}
	used, window := ctrl.ContextSnapshot()
	pUsed, pWindow := ctrl.PlannerContextSnapshot()
	return ContextInfo{Used: used, Window: window, PlannerUsed: pUsed, PlannerWindow: pWindow}
}

// TCCAReport returns the TCCA cache metrics as a JSON string (V3.0).
// Returns "{}" when the controller or context manager is not available.
func (a *App) TCCAReport() string {
	a.mu.RLock()
	ctrl := a.ctrl
	a.mu.RUnlock()
	if ctrl == nil {
		return "{}"
	}
	report := ctrl.TCCAReport()
	b, err := json.Marshal(report)
	if err != nil {
		return "{}"
	}
	return string(b)
}

// Balance queries the active provider's wallet balance (a network call). It
// returns an empty (unavailable) readout when no provider balance_url is set, the
// controller is down, or the fetch fails — so the status bar simply shows nothing
// rather than an error.
func (a *App) Balance() BalanceInfo {
	a.mu.RLock()
	ctrl := a.ctrl
	a.mu.RUnlock()
	if ctrl == nil {
		return BalanceInfo{}
	}
	b, err := ctrl.Balance(a.ctx)
	if err != nil {
		return BalanceInfo{Err: err.Error()}
	}
	if b == nil {
		return BalanceInfo{} // provider declares no balance endpoint
	}
	return BalanceInfo{Available: true, Display: b.Display()}
}

// Jobs returns the still-running background jobs for the status bar. It refreshes
// on demand (mount, turn end, and on each notice the frontend receives).
func (a *App) Jobs() []JobView {
	out := []JobView{}
	a.mu.RLock()
	ctrl := a.ctrl
	a.mu.RUnlock()
	if ctrl == nil {
		return out
	}
	for _, v := range ctrl.Jobs() {
		out = append(out, JobView{ID: v.ID, Kind: v.Kind, Label: v.Label, Status: v.Status, StartedAt: v.StartedAt})
	}
	return out
}

// Meta reports the model label, readiness, any startup error, the working
// directory (for the status line), and the runtime event channel the frontend
// subscribes to.
func (a *App) Meta() Meta {
	a.mu.RLock()
	label := a.label
	subagentLabel := a.subagentLabel
	plannerLabel := a.plannerLabel
	startupErr := a.startupErr
	ready := a.ready
	ctrl := a.ctrl
	a.mu.RUnlock()
	cwd, _ := os.Getwd()
	permLevel := "ask"
	if ctrl != nil {
		permLevel = ctrl.PermLevel()
	}
	return Meta{
		Label:         label,
		SubagentLabel: subagentLabel,
		PlannerLabel:  plannerLabel,
		Ready:        ready,
		StartupErr:   startupErr,
		EventChannel: eventChannel,
		Cwd:          cwd,
		Bypass:       ctrl != nil && ctrl.PermLevel() != "ask",
		PermLevel:    permLevel,
	}
}

// Commands lists the slash commands available this session — built-in actions,
// custom commands (.gaeaW/commands), and MCP prompts — for the composer's "/"
// autocomplete menu.
func (a *App) Commands() []CommandInfo {
	out := []CommandInfo{
		{Name: "new", Description: i18n.M.CmdNew, Kind: "builtin"},
		{Name: "compact", Description: i18n.M.CmdCompact, Kind: "builtin"},
		{Name: "model", Description: i18n.M.CmdModel, Kind: "builtin"},
		{Name: "memory", Description: i18n.M.CmdMemory, Kind: "builtin"},
		{Name: "mcp", Description: i18n.M.CmdMcp, Kind: "builtin"},
		{Name: "hooks", Description: i18n.M.CmdHooks, Kind: "builtin"},
		{Name: "skill", Description: i18n.M.CmdSkill, Kind: "builtin"},
	}
	a.mu.RLock()
	ctrl := a.ctrl
	a.mu.RUnlock()
	if ctrl == nil {
		return out
	}
	// Skills are invocable as /<name> (the model runs inline ones; subagent ones
	// run isolated). Listing them here is what surfaces /init, /explore, … in the
	// composer's slash menu; selecting one submits "/<name>", which the controller
	// resolves via RunSkill.
	for _, s := range ctrl.Skills() {
		out = append(out, CommandInfo{Name: s.Name, Description: s.Description, Kind: "skill"})
	}
	for _, c := range ctrl.Commands() {
		out = append(out, CommandInfo{Name: c.Name, Description: c.Description, Hint: c.ArgHint, Kind: "custom"})
	}
	if h := ctrl.Host(); h != nil {
		for _, p := range h.Prompts() {
			out = append(out, CommandInfo{Name: p.Name, Description: p.Description, Kind: "mcp"})
		}
	}
	return out
}

// SlashArgs completes the arguments of a management slash command (/mcp, /model,
// /skill, /hooks) for the composer — the same logic the chat TUI uses. Empty
// Items means the input has no structured arguments to complete.
func (a *App) SlashArgs(input string) SlashArgsResult {
	a.mu.RLock()
	ctrl := a.ctrl
	model := a.model
	a.mu.RUnlock()
	if ctrl == nil {
		return SlashArgsResult{}
	}
	data := control.ArgData{
		Skills:       ctrl.Skills(),
		CurrentModel: model,
	}
	for _, m := range a.Models() {
		data.ModelRefs = append(data.ModelRefs, m.Ref)
	}
	if h := ctrl.Host(); h != nil {
		data.ServerNames = h.ServerNames()
	}
	items, from := control.SlashArgItems(input, data)
	// Non-nil so it serializes as a JSON array, never null — the frontend filters
	// over it directly.
	out := SlashArgsResult{Items: []SlashArgItem{}, From: from}
	for _, it := range items {
		out.Items = append(out.Items, SlashArgItem{Label: it.Label, Insert: it.Insert, Hint: it.Hint, Descend: it.Descend})
	}
	return out
}

// Models flattens the configured providers into their (provider, model) pairs —
// the switcher's options — marking the active one. A vendor with a `models` list
// yields one entry per model, all sharing the same endpoint/key. Unconfigured
// providers are skipped. Result is non-nil: the frontend reads .length, so a nil
// slice (JSON null) would crash the switcher on an empty list.
func (a *App) Models() []ModelInfo {
	a.mu.RLock()
	curModel := a.model
	a.mu.RUnlock()
	cfg, err := config.Load()
	if err != nil {
		return nil
	}
	out := []ModelInfo{}
	for i := range cfg.Providers {
		p := &cfg.Providers[i]
		if p.Kind == "xai" {
			if !xai.IsLoggedIn() {
				continue
			}
		} else if !p.Configured() {
			continue
		}
		for _, m := range p.ModelList() {
			ref := p.Name + "/" + m
			out = append(out, ModelInfo{Ref: ref, Provider: p.Name, Model: m, Current: ref == curModel})
		}
	}
	return out
}

// SetModel switches the active model and carries the current conversation into the
// new model's session, so the chat continues seamlessly and subsequent turns use
// the new model. (Switching models necessarily resets the prompt cache; that's the
// cost of the switch.) No-op if name is already active or the controller is down.
func (a *App) SetModel(name string) error {
	if a.ctx == nil || name == "" {
		return nil
	}
	a.mu.RLock()
	curModel := a.model
	ctrl := a.ctrl
	a.mu.RUnlock()
	if name == curModel {
		return nil
	}

	var carried []provider.Message
	var savedPermLevel string
	if ctrl != nil {
		_ = ctrl.Snapshot()
		carried = ctrl.History()
		savedPermLevel = ctrl.PermLevel()
		ctrl.Close()
	}

	newCtrl, err := boot.Build(a.ctx, boot.Options{
		Model: name, RequireKey: false, Sink: a.sink,
		SessionDir: ctrl.SessionDir(),
	})
	if err != nil {
		return err
	}
	a.mu.Lock()
	a.ctrl = newCtrl
	a.model = name
	a.label = newCtrl.Label()
	a.mu.Unlock()
	newCtrl.EnableInteractiveApproval()
	if savedPermLevel != "" && savedPermLevel != "ask" {
		newCtrl.SetPermLevel(savedPermLevel)
	}

	path := ""
	if dir := newCtrl.SessionDir(); dir != "" {
		path = agent.NewSessionPath(dir, newCtrl.Label())
	}
	// Carry the prior conversation (full provider.Message log, incl. the system
	// prompt) into the new session so history is preserved across the switch.
	if len(carried) > 0 {
		newCtrl.Resume(&agent.Session{Messages: carried}, path)
	} else if path != "" {
		newCtrl.SetSessionPath(path)
	}
	return nil
}

// Memory returns the loaded memory for the panel: the TIANXUAN.md hierarchy, the
// saved auto-memories, and the writable scopes. Read-only; mutations go through
// Remember / SaveDoc.
func (a *App) Memory() MemoryView {
	// Always return non-nil slices: a nil Go slice marshals to JSON `null`, which
	// would crash the panel's `view.facts.length` / `.map`.
	view := MemoryView{Docs: []MemoryDoc{}, Facts: []MemoryFact{}, Scopes: []MemoryScope{}}
	a.mu.RLock()
	ctrl := a.ctrl
	a.mu.RUnlock()
	if ctrl == nil {
		return view
	}
	set := ctrl.Memory()
	if set == nil {
		return view
	}
	view.StoreDir = set.Store.Dir
	view.Available = true
	for _, d := range set.Docs {
		view.Docs = append(view.Docs, MemoryDoc{Path: d.Path, Scope: string(d.Scope), Body: d.Body})
	}
	for _, f := range set.Store.List() {
		view.Facts = append(view.Facts, MemoryFact{
			Name: f.Name, Title: f.Title, Description: f.Description, Type: string(f.Type), Body: f.Body,
		})
	}
	for _, sc := range writableScopes {
		if p := set.DocPath(sc); p != "" { // user scope yields "" when no config dir
			view.Scopes = append(view.Scopes, MemoryScope{Scope: string(sc), Path: p})
		}
	}
	return view
}

// Remember quick-adds a one-line note to the doc-memory file for scope — the
// panel's explicit "remember" action, equivalent to typing "#<note>". An unknown
// scope falls back to project. Returns the file written.
func (a *App) Remember(scope, note string) (string, error) {
	a.mu.RLock()
	ctrl := a.ctrl
	a.mu.RUnlock()
	if ctrl == nil {
		return "", nil
	}
	return ctrl.QuickAdd(parseScope(scope), note)
}

// Forget deletes a saved auto-memory by name — the panel's delete action for a
// fact the model owns. A no-op when no controller is attached.
func (a *App) Forget(name string) error {
	a.mu.RLock()
	ctrl := a.ctrl
	a.mu.RUnlock()
	if ctrl == nil {
		return nil
	}
	return ctrl.ForgetMemory(name)
}

// UpdateFact overwrites a saved fact's body by name — the panel's in-place
// editor for fact cards. Returns the file written.
func (a *App) UpdateFact(name, body string) (string, error) {
	a.mu.RLock()
	ctrl := a.ctrl
	a.mu.RUnlock()
	if ctrl == nil {
		return "", nil
	}
	return ctrl.UpdateFact(name, body)
}

// ChangeFactType changes the Type of a saved fact — promote to "user" level,
// demote to "project"/"feedback", etc. Returns the file written.
func (a *App) ChangeFactType(name, typ string) (string, error) {
	a.mu.RLock()
	ctrl := a.ctrl
	a.mu.RUnlock()
	if ctrl == nil {
		return "", nil
	}
	if err := ctrl.ChangeFactType(name, typ); err != nil {
		return "", err
	}
	return name, nil
}

// SaveDoc overwrites a memory doc with the panel editor's contents. The controller

// SaveDoc overwrites a memory doc with the panel editor's contents. The controller
// validates path against the recognized memory files. Returns the file written.
func (a *App) SaveDoc(path, body string) (string, error) {
	a.mu.RLock()
	ctrl := a.ctrl
	a.mu.RUnlock()
	if ctrl == nil {
		return "", nil
	}
	return ctrl.SaveDoc(path, body)
}

// parseScope maps a frontend scope id to a memory.Scope, defaulting to project.
func parseScope(s string) memory.Scope {
	switch memory.Scope(s) {
	case memory.ScopeUser:
		return memory.ScopeUser
	case memory.ScopeLocal:
		return memory.ScopeLocal
	default:
		return memory.ScopeProject
	}
}

// openKnowledgeStore opens the user's knowledge directory (~/.gaeaW/knowledge).
func openKnowledgeStore() (*knowledge.Store, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	dir := filepath.Join(home, ".gaeaW", "knowledge")
	return knowledge.Open(dir)
}

// KnowledgeSummary is the lightweight view of a knowledge entry (without body).
type KnowledgeSummary struct {
	Name      string    `json:"name"`
	Title     string    `json:"title"`
	Category  string    `json:"category"`
	Tags      []string  `json:"tags"`
	Status    string    `json:"status"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// KnowledgeEntry is the full knowledge entry including body.
type KnowledgeEntry struct {
	Name       string    `json:"name"`
	Title      string    `json:"title"`
	Category   string    `json:"category"`
	Phase      string    `json:"phase"`
	Discipline string    `json:"discipline"`
	Tags       []string  `json:"tags"`
	Status     string    `json:"status"`
	Version    int       `json:"version"`
	Author     string    `json:"author"`
	Reviewer   string    `json:"reviewer"`
	Source     string    `json:"source"`
	Body       string    `json:"body"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

// KnowledgeList returns all knowledge entries as summaries (without body).
func (a *App) KnowledgeList() []KnowledgeSummary {
	store, err := openKnowledgeStore()
	if err != nil {
		return []KnowledgeSummary{}
	}
	list := store.List()
	out := make([]KnowledgeSummary, 0, len(list))
	for _, s := range list {
		out = append(out, KnowledgeSummary{
			Name:      s.Name,
			Title:     s.Title,
			Category:  s.Category,
			Tags:      s.Tags,
			Status:    s.Status,
			UpdatedAt: s.UpdatedAt,
		})
	}
	return out
}

// KnowledgeGet returns a single knowledge entry with full body by name.
// Returns nil when the entry is not found.
func (a *App) KnowledgeGet(name string) *KnowledgeEntry {
	store, err := openKnowledgeStore()
	if err != nil {
		return nil
	}
	e, err := store.Get(name)
	if err != nil {
		return nil
	}
	return &KnowledgeEntry{
		Name:       e.Name,
		Title:      e.Title,
		Category:   e.Category,
		Phase:      e.Phase,
		Discipline: e.Discipline,
		Tags:       e.Tags,
		Status:     e.Status,
		Version:    e.Version,
		Author:     e.Author,
		Reviewer:   e.Reviewer,
		Source:     e.Source,
		Body:       e.Body,
		CreatedAt:  e.CreatedAt,
		UpdatedAt:  e.UpdatedAt,
	}
}

// KnowledgeSave saves a knowledge entry (create or update).
func (a *App) KnowledgeSave(entry KnowledgeEntry) error {
	store, err := openKnowledgeStore()
	if err != nil {
		return err
	}
	return store.Save(knowledge.Entry{
		Name:       entry.Name,
		Title:      entry.Title,
		Category:   entry.Category,
		Phase:      entry.Phase,
		Discipline: entry.Discipline,
		Tags:       entry.Tags,
		Status:     entry.Status,
		Version:    entry.Version,
		Author:     entry.Author,
		Reviewer:   entry.Reviewer,
		Source:     entry.Source,
		Body:       entry.Body,
	})
}

// KnowledgeDelete deletes a knowledge entry by name.
func (a *App) KnowledgeDelete(name string) error {
	store, err := openKnowledgeStore()
	if err != nil {
		return err
	}
	return store.Delete(name)
}

// ── 成本库 ────────────────────────────────────────────────────────────────

// ── 成本库 ────────────────────────────────────────────────────────────────

// CostItemView 是前端展示用的成本条目结构。
type CostItemView struct {
	Code         string  `json:"code"`
	Name         string  `json:"name"`
	Category     string  `json:"category"`
	Unit         string  `json:"unit"`
	BasePrice    float64 `json:"basePrice"`
	LaborCost    float64 `json:"laborCost"`
	MaterialCost float64 `json:"materialCost"`
	MachineCost  float64 `json:"machineCost"`
	OverheadRate float64 `json:"overheadRate"`
	ProfitRate   float64 `json:"profitRate"`
	TaxRate      float64 `json:"taxRate"`
	WasteFactor  float64 `json:"wasteFactor"`
	Source       string  `json:"source"`
	Confidence   float64 `json:"confidence"`
	Region       string  `json:"region"`
	ValidFrom    string  `json:"validFrom"`
	ValidTo      string  `json:"validTo,omitempty"`
	Remark       string  `json:"remark,omitempty"`
}

// LaborItemView 是前端展示用的人工单价结构。
type LaborItemView struct {
	TradeType string  `json:"tradeType"`
	Unit      string  `json:"unit"`
	Price     float64 `json:"price"`
	Region    string  `json:"region"`
	PriceDate string  `json:"priceDate"`
	Source    string  `json:"source"`
}

// MaterialItemView 是前端展示用的材料价格结构。
type MaterialItemView struct {
	Code      string  `json:"code"`
	NameSpec  string  `json:"nameSpec"`
	Unit      string  `json:"unit"`
	Price     float64 `json:"price"`
	Source    string  `json:"source"`
	PriceDate string  `json:"priceDate"`
	Region    string  `json:"region"`
}

// MachineItemView 是前端展示用的机械台班结构。
type MachineItemView struct {
	Code          string  `json:"code"`
	NameSpec      string  `json:"nameSpec"`
	Unit          string  `json:"unit"`
	PurchasePrice float64 `json:"purchasePrice"`
	HourlyRate    float64 `json:"hourlyRate"`
	FuelRate      float64 `json:"fuelRate"`
	OperatorLabor float64 `json:"operatorLabor"`
	Region        string  `json:"region"`
}

// RegionFactorView 是前端展示用的地区系数结构。
type RegionFactorView struct {
	Region           string  `json:"region"`
	AdjustmentFactor float64 `json:"adjustmentFactor"`
	ValidFrom        string  `json:"validFrom"`
}

// CostDBView 是完整的成本库快照，供前端展示和编辑。
type CostDBView struct {
	Items     []CostItemView     `json:"items"`
	Labor     []LaborItemView    `json:"labor"`
	Materials []MaterialItemView `json:"materials"`
	Machines  []MachineItemView  `json:"machines"`
	Regions   []RegionFactorView `json:"regions"`
}

// EstimateRequest 是前端的估算请求输入。
type EstimateRequest struct {
	Codes      []string  `json:"codes"`
	Quantities []float64 `json:"quantities"`
	Region     string    `json:"region"`
}

// EstimateResultItemView 是估算结果中的一行。
type EstimateResultItemView struct {
	Code      string  `json:"code"`
	Name      string  `json:"name"`
	Unit      string  `json:"unit"`
	UnitPrice float64 `json:"unitPrice"`
	Quantity  float64 `json:"quantity"`
	Subtotal  float64 `json:"subtotal"`
}

// EstimateResultView 是完整的估算结果。
type EstimateResultView struct {
	Total     float64                  `json:"total"`
	Breakdown []EstimateResultItemView `json:"breakdown"`
}

// ImportResultView 是 CSV 导入操作的结果。
type ImportResultView struct {
	Added   int      `json:"added"`
	Skipped int      `json:"skipped"`
	Errors  []string `json:"errors,omitempty"`
}


// CostDBLoad 返回成本库完整快照。
func (a *App) CostDBLoad() *CostDBView {
	db, err := costdb.Load("")
	if err != nil {
		return &CostDBView{
			Items:     []CostItemView{},
			Labor:     []LaborItemView{},
			Materials: []MaterialItemView{},
			Machines:  []MachineItemView{},
			Regions:   []RegionFactorView{},
		}
	}
	view := &CostDBView{
		Items:     make([]CostItemView, len(db.Items)),
		Labor:     make([]LaborItemView, len(db.Labor)),
		Materials: make([]MaterialItemView, len(db.Materials)),
		Machines:  make([]MachineItemView, len(db.Machines)),
		Regions:   make([]RegionFactorView, len(db.Regions)),
	}
	for i, it := range db.Items {
		view.Items[i] = CostItemView{
			Code: it.Code, Name: it.Name, Category: it.Category, Unit: it.Unit,
			BasePrice: it.BasePrice, LaborCost: it.LaborCost, MaterialCost: it.MaterialCost,
			MachineCost: it.MachineCost, OverheadRate: it.OverheadRate, ProfitRate: it.ProfitRate,
			TaxRate: it.TaxRate, WasteFactor: it.WasteFactor, Source: it.Source,
			Confidence: it.Confidence, Region: it.Region, ValidFrom: it.ValidFrom,
			ValidTo: it.ValidTo, Remark: it.Remark,
		}
	}
	for i, l := range db.Labor {
		view.Labor[i] = LaborItemView{TradeType: l.TradeType, Unit: l.Unit, Price: l.Price, Region: l.Region, PriceDate: l.PriceDate, Source: l.Source}
	}
	for i, m := range db.Materials {
		view.Materials[i] = MaterialItemView{Code: m.Code, NameSpec: m.NameSpec, Unit: m.Unit, Price: m.Price, Source: m.Source, PriceDate: m.PriceDate, Region: m.Region}
	}
	for i, m := range db.Machines {
		view.Machines[i] = MachineItemView{Code: m.Code, NameSpec: m.NameSpec, Unit: m.Unit, PurchasePrice: m.PurchasePrice, HourlyRate: m.HourlyRate, FuelRate: m.FuelRate, OperatorLabor: m.OperatorLabor, Region: m.Region}
	}
	for i, r := range db.Regions {
		view.Regions[i] = RegionFactorView{Region: r.Region, AdjustmentFactor: r.AdjustmentFactor, ValidFrom: r.ValidFrom}
	}
	return view
}

// CostDBSave 保存前端传入的完整成本库快照。
func (a *App) CostDBSave(data CostDBView) error {
	// 将 View 结构映射回 costdb 类型
	items := make([]costdb.CostItem, len(data.Items))
	for i, v := range data.Items {
		items[i] = costdb.CostItem{
			Code: v.Code, Name: v.Name, Category: v.Category, Unit: v.Unit,
			BasePrice: v.BasePrice, LaborCost: v.LaborCost, MaterialCost: v.MaterialCost,
			MachineCost: v.MachineCost, OverheadRate: v.OverheadRate, ProfitRate: v.ProfitRate,
			TaxRate: v.TaxRate, WasteFactor: v.WasteFactor, Source: v.Source,
			Confidence: v.Confidence, Region: v.Region, ValidFrom: v.ValidFrom,
			ValidTo: v.ValidTo, Remark: v.Remark,
		}
	}
	labor := make([]costdb.LaborItem, len(data.Labor))
	for i, v := range data.Labor {
		labor[i] = costdb.LaborItem{TradeType: v.TradeType, Unit: v.Unit, Price: v.Price, Region: v.Region, PriceDate: v.PriceDate, Source: v.Source}
	}
	materials := make([]costdb.MaterialItem, len(data.Materials))
	for i, v := range data.Materials {
		materials[i] = costdb.MaterialItem{Code: v.Code, NameSpec: v.NameSpec, Unit: v.Unit, Price: v.Price, Source: v.Source, PriceDate: v.PriceDate, Region: v.Region}
	}
	machines := make([]costdb.MachineItem, len(data.Machines))
	for i, v := range data.Machines {
		machines[i] = costdb.MachineItem{Code: v.Code, NameSpec: v.NameSpec, Unit: v.Unit, PurchasePrice: v.PurchasePrice, HourlyRate: v.HourlyRate, FuelRate: v.FuelRate, OperatorLabor: v.OperatorLabor, Region: v.Region}
	}
	regions := make([]costdb.RegionFactor, len(data.Regions))
	for i, v := range data.Regions {
		regions[i] = costdb.RegionFactor{Region: v.Region, AdjustmentFactor: v.AdjustmentFactor, ValidFrom: v.ValidFrom}
	}

	// 直接通过 SetData+Save 写入文件（避开 costdb 包内部一致性检查）
	db := &costdb.CostDB{}
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	db.SetPath(filepath.Join(home, ".gaeaW", "costdb.json"))
	db.SetData(items, labor, materials, machines, regions)
	return db.Save()
}

// CostEstimate 计算批量估算结果。
func (a *App) CostEstimate(codes []string, quantities []float64, region string) *EstimateResultView {
	db, err := costdb.Load("")
	if err != nil {
		return &EstimateResultView{Breakdown: []EstimateResultItemView{}}
	}
	if region == "" {
		region = "全国"
	}
	items := make([]costdb.EstimateItem, len(codes))
	for i := range codes {
		items[i] = costdb.EstimateItem{Code: codes[i], Quantity: quantities[i]}
	}
	total, breakdown, err := db.Estimate(items, region)
	if err != nil {
		return &EstimateResultView{Breakdown: []EstimateResultItemView{}}
	}
	view := &EstimateResultView{Total: total, Breakdown: make([]EstimateResultItemView, len(breakdown))}
	for i, r := range breakdown {
		view.Breakdown[i] = EstimateResultItemView{
			Code: r.Code, Name: r.Name, Unit: r.Unit,
			UnitPrice: r.UnitPrice, Quantity: r.Quantity, Subtotal: r.Subtotal,
		}
	}
	return view
}

// backupDir returns the backup directory path.
func backupDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, ".gaeaW", "backups")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", err
	}
	return dir, nil
}

// CostDBExportCSV 导出一个成本库表格为 CSV 文本。kind 取值：items/labor/material/machine/regions。
func (a *App) CostDBExportCSV(kind string) string {
	db, err := costdb.Load("")
	if err != nil {
		return ""
	}
	data, err := db.ExportCSV(kind)
	if err != nil {
		return ""
	}
	return string(data)
}

// CostDBImportCSV 从 CSV 文本导入数据到成本库，返回导入结果。
func (a *App) CostDBImportCSV(kind string, csvData string) *ImportResultView {
	db, err := costdb.Load("")
	if err != nil {
		return &ImportResultView{Errors: []string{err.Error()}}
	}
	summary, err := db.ImportCSV(kind, []byte(csvData))
	if err != nil {
		return &ImportResultView{Errors: []string{err.Error()}}
	}
	return &ImportResultView{
		Added:   summary.Added,
		Skipped: summary.Skipped,
		Errors:  summary.Errors,
	}
}

// CostDBBackup 在 ~/.gaeaW/backups/ 创建时间戳备份，返回备份文件名。
func (a *App) CostDBBackup() (string, error) {
	dir, err := backupDir()
	if err != nil {
		return "", err
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	src := filepath.Join(home, ".gaeaW", "costdb.json")
	data, err := os.ReadFile(src)
	if err != nil {
		return "", fmt.Errorf("读取成本库失败: %w", err)
	}
	ts := time.Now().Format("20060102-150405")
	filename := "costdb-" + ts + ".json"
	dst := filepath.Join(dir, filename)
	if err := os.WriteFile(dst, data, 0644); err != nil {
		return "", fmt.Errorf("写入备份失败: %w", err)
	}
	return filename, nil
}

// CostDBListBackups 列出备份目录中的所有备份文件名。
func (a *App) CostDBListBackups() []string {
	dir, err := backupDir()
	if err != nil {
		return []string{}
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return []string{}
	}
	var names []string
	for _, e := range entries {
		if !e.IsDir() {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)
	return names
}

// CostDBRestore 从备份文件恢复成本库。
func (a *App) CostDBRestore(filename string) error {
	dir, err := backupDir()
	if err != nil {
		return err
	}
	src := filepath.Join(dir, filename)
	if _, err := os.Stat(src); err != nil {
		return fmt.Errorf("备份文件不存在: %s", filename)
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	dst := filepath.Join(home, ".gaeaW", "costdb.json")
	data, err := os.ReadFile(src)
	if err != nil {
		return fmt.Errorf("读取备份失败: %w", err)
	}
	if err := os.WriteFile(dst, data, 0644); err != nil {
		return fmt.Errorf("写入成本库失败: %w", err)
	}
	return nil
}
