// Command gaeaW is a config- and plugin-driven coding agent CLI.
package main

import (
	"os"

	"gaeaW/internal/cli"
	"gaeaW/internal/crash"

	// Blank imports wire compile-time built-ins into their registries.
	_ "gaeaW/internal/provider/anthropic"
	_ "gaeaW/internal/provider/openai"
	_ "gaeaW/internal/tool/builtin"
)

// version is injected at build time via -ldflags "-X main.version=...".
var version = "dev"

func main() {
	defer crash.Handle()
	os.Exit(cli.Run(os.Args[1:], version))
}
