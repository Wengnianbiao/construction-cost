# 工程造价速算

中文工程成本估算工具，支持面积速算、工程量清单和预备费。金额逐项四舍五入到分，再汇总。

[打开工程造价速算](https://wengnianbiao.github.io/construction-cost/)

单价和费率由使用者填写，内置示例仅用于演示。计算在浏览器完成，保存的项目留在当前浏览器中。

## 本地预览

在仓库目录运行以下命令，再打开 [本地预览](http://127.0.0.1:8000/)。

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

## 发布

在仓库的 **Settings → Pages** 中，选择 **Deploy from a branch**，使用 **main / (root)**。
