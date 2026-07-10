# Local Comment 文档网站

基于 Jekyll 的静态文档站点。

## 环境要求

- Ruby >= 2.7
- Bundler

## 安装依赖

```bash
cd website
bundle install
```

## 本地开发

启动本地服务器，支持热更新：

```bash
bundle exec jekyll serve
```

访问 http://localhost:4000/vscode-local-comment/

## 构建生产版本

```bash
bundle exec jekyll build
```

生成的静态文件在 `_site` 目录。

## 目录结构

```
├── _docs/          # 文档内容 (Markdown)
├── _includes/      # 可复用组件 (HTML)
├── _layouts/       # 页面模板
├── _sass/          # 样式文件
├── assets/         # 静态资源 (图片、字体等)
├── _config.yml    # Jekyll 配置
└── Gemfile         # Ruby 依赖
```

## 注意事项

- `baseurl` 配置为 `/vscode-local-comment`，部署时需配合 GitHub Pages
- 文档链接使用 `relative_url` 过滤器，确保在不同路径下正确解析