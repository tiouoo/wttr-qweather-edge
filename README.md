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

不填写城市时，接口只根据 Cloudflare 提供的出口 IP 地理信息定位。它会优先按该 IP 的经纬度查询，再按城市名查询，并用 IP 对应的国家缩小匹配范围。VPN 出口的位置取决于 IP 库，可能与实际所在地或 VPN 节点标注不同。没有匹配城市时会显示北京天气。

```text
https://weather.chilo.top/
```

默认返回单行天气：

```text
北京: 🌙 27°C 南风 10 km/h
```

响应头 `X-Weather-Location-Source` 会标明位置来源，可能是 `explicit`（指定城市）、`ip`（按 IP 定位）或 `fallback`（回退到北京）。

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

接口支持 HTTP 和 HTTPS。可以直接访问 `http://weather.chilo.top/Beijing`。

## 部署到 Cloudflare Workers

在 GitHub 仓库的 **Settings → Secrets and variables → Actions → Secrets** 添加以下 Repository secrets。

| Secret                 | 填写内容                                                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `CF_ACCOUNT_ID`        | Cloudflare 账户的 Account ID，使用你已设置的账户 ID。                                                                |
| `CF_WORKER_EDIT`       | Cloudflare API Token。可用 **Edit Cloudflare Workers** 模板创建，至少授予目标账户的 **Workers Scripts: Edit** 权限。 |
| `QWEATHER_API_HOST`    | 和风天气控制台显示的专属 API Host，例如 `your-api-host.re.qweatherapi.com`。可带 `https://`。                        |
| `QWEATHER_KID`         | 和风天气项目中新建的 JWT 凭据的 **凭据 ID**。                                                                        |
| `QWEATHER_PROJECT_ID`  | 和风天气控制台中的 **项目 ID**。                                                                                     |
| `QWEATHER_PRIVATE_KEY` | 与该 JWT 凭据登记的公钥配对的 Ed25519 PKCS#8 私钥。粘贴完整多行 PEM，包含头尾行。                                    |

```sh
openssl genpkey -algorithm ED25519 -out qweather-private.pem
openssl pkey -in qweather-private.pem -pubout -out qweather-public.pem
```

在和风天气控制台创建 JWT 凭据时上传 `qweather-public.pem`，把生成的凭据 ID 填入 `QWEATHER_KID`，把 `qweather-private.pem` 的完整内容填入 `QWEATHER_PRIVATE_KEY`。
