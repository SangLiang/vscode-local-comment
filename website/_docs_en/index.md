---
title: Documentation
layout: docs
permalink: /en/docs/
lang: en
---

{% assign lang = page.lang | default: 'zh' %}
{% assign t = site.data.i18n.docs_index[lang] %}

# {{ t.title }}

{{ t.welcome }}

## {{ t.toc_title }}

- [{{ t.quick_start }}]({{ "/en/docs/quick-start/" | relative_url }}) - {{ t.quick_start_desc }}
- [{{ t.comments }}]({{ "/en/docs/comments/" | relative_url }}) - {{ t.comments_desc }}
- [{{ t.bookmarks }}]({{ "/en/docs/bookmarks/" | relative_url }}) - {{ t.bookmarks_desc }}
- [{{ t.tags }}]({{ "/en/docs/tags/" | relative_url }}) - {{ t.tags_desc }}
- [{{ t.markdown }}]({{ "/en/docs/markdown/" | relative_url }}) - {{ t.markdown_desc }}
- [{{ t.data_management }}]({{ "/en/docs/data/" | relative_url }}) - {{ t.data_management_desc }}
- [{{ t.reference }}]({{ "/en/docs/reference/" | relative_url }}) - {{ t.reference_desc }}
