---
title: 文档
layout: docs
permalink: /docs/
---

{% assign lang = page.lang | default: 'zh' %}
{% assign t = site.data.i18n.docs_index[lang] %}

# {{ t.title }}

{{ t.welcome }}

## {{ t.toc_title }}

- [{{ t.quick_start }}]({{ "/docs/quick-start/" | relative_url }}) - {{ t.quick_start_desc }}
- [{{ t.comments }}]({{ "/docs/comments/" | relative_url }}) - {{ t.comments_desc }}
- [{{ t.bookmarks }}]({{ "/docs/bookmarks/" | relative_url }}) - {{ t.bookmarks_desc }}
- [{{ t.tags }}]({{ "/docs/tags/" | relative_url }}) - {{ t.tags_desc }}
- [{{ t.markdown }}]({{ "/docs/markdown/" | relative_url }}) - {{ t.markdown_desc }}
- [{{ t.data_management }}]({{ "/docs/data/" | relative_url }}) - {{ t.data_management_desc }}
- [{{ t.reference }}]({{ "/docs/reference/" | relative_url }}) - {{ t.reference_desc }}
