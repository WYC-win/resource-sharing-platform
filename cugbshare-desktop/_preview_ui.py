# -*- coding: utf-8 -*-
"""
生成下载面板的静态预览页，用系统 Edge 无头截图，好在不启动主程序的情况下
肉眼确认 UI（内边距、状态配色、进度条形态）。

用法：python _preview_ui.py     ->  生成 _preview.html，然后由 _shot.ps1 截图
"""

from pathlib import Path

HERE = Path(__file__).resolve().parent
UI = (HERE / "ui.js").read_text(encoding="utf-8")

# 造一份有代表性的状态。注意：列表是**新的在上**（倒序渲染），
# 所以把想看到的那条放在数组**最后**。
STATE = """{
  "tasks": [
    {"id":"e","name":"海洋科学概论 复习提纲.pdf","dir":"C:/DL","path":"",
     "total":524288,"got":131072,"state":"cancelled","error":"已取消","speed":0},
    {"id":"d","name":"概率论与数理统计 历年卷合集.zip","dir":"C:/DL","path":"",
     "total":10485760,"got":3145728,"state":"error","error":"登录已过期，请重新登录后再下载","speed":0},
    {"id":"c","name":"大学物理（下）实验报告模板.docx","dir":"C:/DL","path":"",
     "total":0,"got":500000,"state":"downloading","error":"","speed":61440},
    {"id":"b","name":"线性代数 2019-2020 学年期末真题（含答案）.pdf","dir":"C:/DL","path":"",
     "total":1970726,"got":842137,"state":"downloading","error":"","speed":55296},
    {"id":"a","name":"高等数学（上）2020年秋期中.pdf","dir":"C:/DL","path":"C:/DL/a.pdf",
     "total":177517,"got":177517,"state":"done","error":"","speed":0}
  ],
  "settings": {"ask": true, "dir": "C:/Users/WYC/Desktop"}
}"""

html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>下载面板预览</title>
<style>
  html,body{{margin:0;padding:0;height:100%;}}
  body{{background:#eef1f5;font-family:-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;}}
  .fake-page{{padding:28px 32px;color:#5b6472;font-size:13px;line-height:2;}}
  .fake-page h2{{font-size:15px;color:#303133;margin:0 0 10px;}}
</style></head>
<body>
<div id="app"></div>
<div class="fake-page">
  <h2>（这是模拟的页面背景，只为看清悬浮面板的景深与留白）</h2>
  北地书阁 · 学习资料分享站<br>课程 / 资源列表 / 上传 / 我的
</div>
<script>
{UI}
</script>
<script>
  var S = {STATE};
  window.__cugbDM.update(S);
  window.__cugbDM.toggle(true);   // 展开面板
</script>
</body>
</html>
"""

out = HERE / "_preview.html"
out.write_text(html, encoding="utf-8")
print("已生成:", out, out.stat().st_size, "字节")
