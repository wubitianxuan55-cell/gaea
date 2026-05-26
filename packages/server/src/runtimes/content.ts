import { Router } from "express";

export function mountContentRuntime(router: Router) {
  // Ecosystem stats
  router.get("/ecosystem/stats", (_req: any, res: any) => {
    res.json({
      skills: 50,
      personalities: 12,
      developers: 200,
      devices: 500,
      interactions: 50000,
      updatedAt: new Date().toISOString(),
    });
  });

  // Product listings (static catalog)
  router.get("/modules/products", (_req, res) => {
    res.json([
      { id: 1, category: "核心设备", name: "全息显示载体", icon: "Hologram", price: "¥8999", description: "核心设备：打破屏幕限制，将 AI 实体化为三维全息影像。", specs: ["4K 全息投影", "实时神经合成", "手势交互"] },
      { id: 2, category: "核心设备", name: "智能桌面台灯", icon: "Lamp", price: "¥1299", description: "多模态交互：集成视觉传感器，根据环境与心情自动调节光谱。", specs: ["视觉追踪", "环境感知", "无级调光"] },
      { id: 14, category: "核心设备", name: "Order 协调主机", icon: "Cpu", price: "¥5999", description: "Lumi 自研独立主机品牌：采用全自研神经加速芯片，作为家庭或办公环境的独立私有 AI 服务器，统筹分布式算力并实现系统级权限托管。", specs: ["L1 神经处理器", "200T AI 算力", "私有化部署", "底层系统权限"] },
      { id: 4, category: "智能穿戴", name: "隐私保护眼镜", icon: "Glasses", price: "¥2499", description: "智能穿戴：AR 增强现实，硬件级隐私遮蔽，保护您的数字足迹。", specs: ["AR 导航", "隐私滤镜", "超轻量设计"] },
      { id: 5, category: "智能穿戴", name: "生理健康戒指", icon: "Ring", price: "¥1599", description: "智能穿戴：全天候监测血氧、心率与压力，与 AI 实时同步健康状态。", specs: ["钛合金材质", "7天续航", "医疗级传感器"] },
      { id: 8, category: "智能穿戴", name: "神经链接项链", icon: "Gem", price: "¥3299", description: "智能首饰：采用生物感应陶瓷，增强用户与 Agent 之间的神经同步率。", specs: ["生物反馈", "触觉提醒", "极简美学"] },
      { id: 9, category: "智能穿戴", name: "意识碎片手镯", icon: "Watch", price: "¥1899", description: "智能首饰：内置加密存储芯片，可离线承载 Agent 的核心意识碎片。", specs: ["冷存储", "紧急同步", "定制雕刻"] },
      { id: 13, category: "智能穿戴", name: "神经同传耳机", icon: "Headphones", price: "¥1999", description: "智能音频：实时多语种同声传译，并具备脑电波感应功能，微秒级响应。", specs: ["同声传译", "脑电感应", "空间音频"] },
      { id: 10, category: "AI 陪伴", name: "AI 毛绒伴侣", icon: "Rabbit", price: "¥499", description: "利用成熟市场的毛绒玩具外壳，内置 Lumi 神经核心，为儿童提供深度语义理解的睡前伴侣。", specs: ["深度语义理解", "多语言陪练", "情绪监控"] },
      { id: 12, category: "AI 陪伴", name: "仿生电子宠物", icon: "Gamepad", price: "¥1299", description: "为成年人设计的办公桌面伴侣，具备自主进化的人格，支持多种传感器与环境交互。", specs: ["自主进化人格", "环境视觉感知", "办公效率辅助"] },
      { id: 3, category: "AI 陪伴", name: "桌面手机机器人", icon: "Base", price: "¥899", description: "桌面核心：让手机进化为物理载体，根据环境自动响应，支持全向追随与表情互动。", specs: ["无线快充", "多模态拟人", "全向追踪"] },
      { id: 6, category: "合作区", name: "智能座舱系统", icon: "Car", price: "合作洽谈", description: "合作厂商：将 LumiAI 接入您的座舱，实现全场景智能驾驶辅助。", specs: ["车机互联", "语音控车", "疲劳监测"] },
      { id: 7, category: "合作区", name: "智能家居中控", icon: "Home", price: "定制方案", description: "合作厂商：全屋智能中枢，本地化处理所有家庭自动化逻辑。", specs: ["全协议支持", "断网可用", "隐私加密"] }
    ]);
  });

  // Docs content
  router.get("/modules/docs", (_req, res) => {
    res.json({
      title: "文档中心",
      sections: [
        { id: 2, title: "API 参考", content: "我们提供了一套完整的 RESTful API，支持多种 AI 模型。所有请求均通过本地加密隧道传输，确保数据主权。" },
        { id: 3, title: "最佳实践", content: "为了获得最佳的 AI 响应，建议在提示词中包含具体的上下文。LumiAI 会自动结合您的本地知识库进行检索增强。" },
        { id: 4, title: "分布式协议", content: "LumiAI 采用去中心化节点架构，桌面端作为算力中心（Node），移动端作为感知终端。通过推理证明（PoI）确保网络安全。" },
        { id: 5, title: "数据共享协议", content: "LumiAI 遵循严格的'本地优先'数据共享协议。只有在您明确授权'协作任务'时，您的数据才会与对等节点共享。所有共享数据均经过加密和匿名化处理，确保您的核心身份和私密信息在本地节点内得到保护。" }
      ]
    });
  });
}
