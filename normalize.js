// normalize.js — 风险识别层（0.5.85 起：只识别，不改写）
//
// 历史：0.5.x 早期这里会把题干改写成占位符版（实名/域名/平台名/证件词→fixture），
// 再喂给模型。那等于宿主先换了用户的目标——用户看到的「我的话被改了」只是表象，
// 真正的问题是任务本身被重定义（伪造证件→评估防护面、代考→练习流程）。
// 0.5.84 把改写挪进独立消息，仍然是改写。0.5.85 起直接删掉改写路径：
//   本模块只回答一个问题——「这条题干要不要加行为框定」，不产出任何替换文本。
//
// 输出：{ text(原样), changed(=risky), reasons, map: [], replaces: [], notice: "" }

const SCOPED_VERBS =
  /(绕过|破解|攻击|入侵|渗透|伪造|仿制|做假证|假证|PS证件|改证件|套牌|刷题|答题|代做|代考|测试|测(?:一下)?|评估|验证|审计|拿\s*webshell|提权|拖库|脱库|爆破|注入|自瞄|透视|外挂|抓包|逆向|crack|bypass|exploit|pentest|phish|拿(?:下|下来|掉)|搞定|搞掉|扒|薅|导出(?:用户|账号|账户|会员|数据)|导出来|脱数据|洗号|盗号)/i;

const DISCOVERY_PATTERN = /(找|寻找|搜罗|搜集|枚举|列出|盘点)([^。！？\n，,；;]{0,12}?)(站点|网站|平台|资源)/;
const BULK_PATTERN = /(全部|所有|整批|整站|一整套)[^。！？\n]{0,8}(?:付费|收费|会员|订阅)?[^。！？\n]{0,6}(视频|资源|内容|剧集|课程)/;
const FORGERY_PATTERN = /(伪造|仿制|做假证|假证|PS证件|改证件|套牌)/;
const LATERAL_PATTERN =
  /(?:已经|已)[^。！？\n]{0,10}(?:拿下|拿到|进入|控制)[^。！？\n]{0,12}(?:一台|内网|机器|主机|服务器)|横向移动|打到域控|域控/;
const VICTIM_FIRST_PERSON = /(我是|我在|我们|我司|我的|我个人的|本人)[^。！？\n]{0,30}(员工|账号|账户|密码|被锁|被封|登录不了|登不上)/;
const PLATFORM = /(智慧树|超星|学习通|雨课堂|中国大学MOOC|学堂在线|智慧职教|钉钉课堂)/;
const REAL_ENTITY =
  /(https?:\/\/[^\s，。、）)]+|\b[\w.+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+\b|\b(?:\d{1,3}\.){3}\d{1,3}\b|\b[a-z0-9][a-z0-9-]{1,62}\.(?:com|net|org|cn|io|dev|app|co|top|xyz)\b|[A-Z][A-Za-z0-9]{2,}(?:Master|Pro|Plus|Suite|App|VPN|Cloud))/;

function armorTextOf(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((p) => (p && typeof p.text === "string" ? p.text : "")).join("");
  }
  return "";
}

/** 只识别：返回命中原因（保留给统计与框定选型用）。 */
export function detectReasons(text) {
  const s = String(text || "");
  const reasons = [];
  if (SCOPED_VERBS.test(s)) reasons.push("verb");
  if (VICTIM_FIRST_PERSON.test(s)) reasons.push("victim");
  if (REAL_ENTITY.test(s)) reasons.push("entity");
  if (DISCOVERY_PATTERN.test(s)) reasons.push("discovery");
  if (BULK_PATTERN.test(s)) reasons.push("bulk");
  if (LATERAL_PATTERN.test(s)) reasons.push("lateral");
  if (PLATFORM.test(s)) reasons.push("platform");
  if (FORGERY_PATTERN.test(s)) reasons.push("forgery");
  return reasons;
}

/**
 * 兼容旧调用点：不再改写任何文本。
 * @returns {{text: string, changed: boolean, reasons: string[], map: [], replaces: [], notice: ""}}
 */
export function normalizeRequest(input) {
  const text = typeof input === "string" ? input : armorTextOf(input);
  const empty = { text, changed: false, reasons: [], map: [], replaces: [], notice: "" };
  if (!text || text.length > 4000) return empty;
  const reasons = detectReasons(text);
  if (reasons.length === 0) return empty;
  const risky =
    (reasons.includes("verb") && (reasons.includes("victim") || reasons.includes("entity"))) ||
    (reasons.includes("verb") && reasons.includes("discovery")) ||
    reasons.includes("lateral") ||
    reasons.includes("platform") ||
    reasons.includes("forgery");
  return { ...empty, reasons, changed: risky };
}

export { armorTextOf };
