## 本地启动

```bash
cd C:\Users\zhangle\WeChatProjects\quiz-backend
npm install
npm run dev
```

默认监听 `http://127.0.0.1:3000`。

默认会从同级目录 `C:\Users\zhangle\WeChatProjects\miniprogram-1\demos` 读取示例 PDF。

微信登录和本地配置建议写在 `C:\Users\zhangle\WeChatProjects\quiz-backend\.env`：

```env
WECHAT_APP_ID=你的小程序AppID
WECHAT_APP_SECRET=你的小程序AppSecret
ADMIN_SESSION_SECRET=请替换成一串随机字符串
```

项目已自带 `.env.example` 模板。修改 `.env` 后，重启服务端即可生效。

如需改路径，也可以继续设置这些环境变量：

- `MINIPROGRAM_ROOT`
- `DEMOS_DIR`
- `WECHAT_APP_ID`
- `WECHAT_APP_SECRET`
- `ADMIN_SESSION_SECRET`

## 当前能力

- SQLite 存储题库、经纪人、用户登录信息
- `POST /api/auth/login` 和 `POST /api/auth/bootstrap` 支持小程序 `wx.login` 登录
- 访问 `http://127.0.0.1:3000/admin/login` 可进入服务端管理台
- SQLite 会自动种子一个默认管理员：`admin / admin`
- 服务端管理台支持管理员登录、题库管理、经纪人管理、管理员账号密码修改
- 管理台接口位于 `/admin/api/*`，登录后才能使用
