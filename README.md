# 天气查询接口

基础地址：

```text
https://weather.chilo.top
```

## 基础调用

查询城市天气：

```text
https://weather.chilo.top/北京
https://weather.chilo.top/Beijing
```

不填写城市时，会根据访问者 IP 定位城市；无法定位或不支持的地区会自动显示北京天气：

```text
https://weather.chilo.top/
```

默认返回单行天气：

```text
北京: 🌙 27°C 南风 10 km/h
```

## 详细预报

添加 `days` 参数可查看未来 1 到 7 天预报：

```text
https://weather.chilo.top/北京?days=3
https://weather.chilo.top/北京?days=7
```

详细预报包含当前天气、体感温度、风况、湿度、气压，以及每日天气图标和最高最低温度。

## 自定义单行格式

使用 `format` 参数组合想显示的内容：

```text
https://weather.chilo.top/北京?format=%l:+%c+%t+%w
```

常用占位符：

```text
%l  城市名称
%c  天气图标
%C  天气文字
%t  当前温度
%f  体感温度
%w  风向和风速
%h  湿度
%p  降水量
%P  气压
%i  和风天气图标代码
%T  观测时间
```

## JSON 数据

完整 JSON：

```text
https://weather.chilo.top/北京?format=j1
```

精简 JSON：

```text
https://weather.chilo.top/北京?format=j2
```

请使用 HTTPS 地址访问。

## 部署到 Cloudflare Workers

在 GitHub 仓库的 **Settings → Secrets and variables → Actions → Secrets** 添加以下 Repository secrets。

| Secret | 填写内容 |
| --- | --- |
| `CF_ACCOUNT_ID` | Cloudflare 账户的 Account ID，使用你已设置的账户 ID。 |
| `CF_WORKER_EDIT` | Cloudflare API Token。可用 **Edit Cloudflare Workers** 模板创建，至少授予目标账户的 **Workers Scripts: Edit** 权限。 |
| `QWEATHER_API_HOST` | 和风天气控制台显示的专属 API Host，例如 `your-api-host.re.qweatherapi.com`。可带 `https://`。 |
| `QWEATHER_KID` | 和风天气项目中新建的 JWT 凭据的 **凭据 ID**。 |
| `QWEATHER_PROJECT_ID` | 和风天气控制台中的 **项目 ID**。 |
| `QWEATHER_PRIVATE_KEY` | 与该 JWT 凭据登记的公钥配对的 Ed25519 PKCS#8 私钥。粘贴完整多行 PEM，包含头尾行。 |

工作流只使用 Worker API Token。`CF_DNS_EDIT` 无需配置，Cloudflare 会为 Worker 自定义域名管理 DNS 和证书。

如果需要绑定 `weather.chilo.top`，在同一页的 **Variables** 添加仓库变量 `CF_CUSTOM_DOMAIN`，值填 `weather.chilo.top`，域名须位于同一 Cloudflare 账户。设置此变量后，部署会尝试把该域名切到 Worker，可能替换现有的 Vercel DNS 记录。如果 Cloudflare 返回 CNAME 冲突，先通过 `workers.dev` 验证 Worker，再移除对应的旧 CNAME 并重新运行部署。

首次使用 `workers.dev` 的账户，请先在 Cloudflare 的 **Workers & Pages** 设置一个子域名。将工作流推送到 GitHub 默认分支，再打开 **Actions → Deploy to Cloudflare Workers → Run workflow**。部署日志会显示服务地址，和风天气凭据由工作流写入 Worker Secrets。

开源前请撤销曾提交进 Git 的旧和风天气 JWT 凭据。可用 OpenSSL 生成新密钥对。

```sh
openssl genpkey -algorithm ED25519 -out qweather-private.pem
openssl pkey -in qweather-private.pem -pubout -out qweather-public.pem
```

在和风天气控制台创建 JWT 凭据时上传 `qweather-public.pem`，把生成的凭据 ID 填入 `QWEATHER_KID`，把 `qweather-private.pem` 的完整内容填入 `QWEATHER_PRIVATE_KEY`。旧私钥仍在已有提交中，公开仓库时请使用清理过的历史或从干净快照建立新仓库。

## 本地开发

安装 Node.js 24，执行 `npm ci`。将 `.dev.vars.example` 复制为 `.dev.vars`，填入同样的四项和风天气凭据，然后执行 `npm run dev`。Wrangler 默认监听 `http://localhost:8787`。
