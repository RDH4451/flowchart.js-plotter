/* Plotter: lightweight validator for the flowchart.js DSL.
   It mirrors the parser closely enough to catch the mistakes that produce
   blank sheets or cryptic errors inside flowchart.js itself. */
(function (global) {
  'use strict';

  var NODE_TYPES = ['start', 'end', 'operation', 'inputoutput', 'input', 'output', 'subroutine', 'condition', 'parallel'];
  var TYPE_SET = Object.create(null);
  NODE_TYPES.forEach(function (t) { TYPE_SET[t] = true; });

  var DIRECTIONS = ['left', 'right', 'top', 'bottom'];
  var DIRECTION_SET = Object.create(null);
  DIRECTIONS.forEach(function (d) { DIRECTION_SET[d] = true; });

  var BRANCHES = { condition: ['yes', 'no'], parallel: ['path1', 'path2', 'path3'] };

  function stripComments(source) {
    return String(source == null ? '' : source)
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map(function (line) { return /^\s*(\/\/|#)/.test(line) ? '' : line; })
      .join('\n');
  }

  function levenshtein(a, b) {
    a = String(a);
    b = String(b);
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    var prev = [];
    var i;
    var j;
    for (j = 0; j <= b.length; j++) prev[j] = j;

    for (i = 1; i <= a.length; i++) {
      var current = [i];
      for (j = 1; j <= b.length; j++) {
        current[j] = Math.min(
          current[j - 1] + 1,
          prev[j] + 1,
          prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1)
        );
      }
      prev = current;
    }
    return prev[b.length];
  }

  function suggest(value, list) {
    var best = null;
    var bestScore = Infinity;
    var lower = String(value).toLowerCase();
    list.forEach(function (candidate) {
      var score = levenshtein(lower, String(candidate).toLowerCase());
      if (score < bestScore) {
        bestScore = score;
        best = candidate;
      }
    });
    var limit = value.length <= 4 ? 1 : 2;
    return bestScore <= limit ? best : null;
  }

  function parseRef(token) {
    token = String(token == null ? '' : token).trim();
    var open = token.indexOf('(');
    var key = token;
    var params = [];
    if (open > -1) {
      var close = token.lastIndexOf(')');
      key = token.slice(0, open).trim();
      if (close > open) {
        params = token.slice(open + 1, close).split(',').map(function (s) {
          return s.trim();
        }).filter(function (s) {
          return s.length > 0;
        });
      }
    }
    return { key: key, params: params };
  }

  function branchOf(param) {
    return String(param == null ? '' : param).split('@')[0].trim();
  }

  function previousMeaningful(lines, index) {
    for (var i = index - 1; i >= 0; i--) {
      var line = lines[i].trim();
      if (!line || /^(\/\/|#)/.test(line)) continue;
      return line;
    }
    return '';
  }

  function validate(source) {
    var lines = String(source == null ? '' : source).replace(/\r\n?/g, '\n').split('\n');
    var issues = [];
    var nodes = Object.create(null);
    var nodeList = [];
    var edges = [];
    var branchSeen = Object.create(null);

    function add(line, severity, message, hint) {
      issues.push({
        line: Math.max(1, line || 1),
        severity: severity,
        message: message,
        hint: hint || ''
      });
    }

    /* ---- definitions ---------------------------------------------------- */
    lines.forEach(function (raw, index) {
      var lineNo = index + 1;
      var line = raw.trim();
      if (!line || /^(\/\/|#)/.test(line)) return;
      if (line.indexOf('=>') === -1) return;

      var arrow = line.indexOf('=>');
      var left = line.slice(0, arrow).trim();
      var right = line.slice(arrow + 2).trim();
      var key = left.replace(/\([^)]*\)\s*$/, '').trim();

      if (!key) {
        add(lineNo, 'error', '“=>” 前面需要一个节点名。', '例如：`st=>start: 开始`。');
        return;
      }

      if (/\s/.test(key)) {
        add(lineNo, 'error', '节点名“' + key + '”包含空格。', '请使用单个单词，如 `orderCheck`；标签写在冒号后面。');
      }

      if (nodes[key]) {
        add(lineNo, 'error', '节点“' + key + '”被重复定义。', '后一个定义会覆盖前一个，请重命名其中一个。');
      }

      var colon = right.indexOf(':');
      var type = (colon === -1 ? right : right.slice(0, colon)).trim();
      var tail = colon === -1 ? '' : right.slice(colon);

      if (!type) {
        add(lineNo, 'error', '节点“' + key + '”缺少类型。', '可用类型：' + NODE_TYPES.join('、') + '。');
        return;
      }

      if (!TYPE_SET[type]) {
        var typeGuess = suggest(type, NODE_TYPES);
        add(
          lineNo,
          'error',
          '未知的节点类型“' + type + '”。' + (typeGuess ? '是不是“' + typeGuess + '”？' : ''),
          '可用类型：' + NODE_TYPES.join('、') + '。'
        );
      }

      if (colon > -1 && tail.length > 1 && tail.charAt(1) !== ' ' && tail.charAt(1) !== '>') {
        add(
          lineNo,
          'error',
          '“' + type + ':' + tail.slice(1, 10) + '”的冒号后缺少空格。',
          'flowchart.js 以“: ”分隔类型和标签，请写成 `' + key + '=>' + type + ': 你的标签`。'
        );
      }

      if (right.indexOf('=>') > -1) {
        add(lineNo, 'warning', '标签中包含“=>”，可能被解析为另一个节点定义。', '请避免在标签中使用“=>”。');
      }

      var text = tail.replace(/^:\s?/, '');
      var linkAt = text.indexOf(':>');
      if (linkAt > -1) text = text.slice(0, linkAt);

      var pipeAt = text.lastIndexOf('|');
      var flowstate = '';
      if (pipeAt > -1) {
        flowstate = text.slice(pipeAt + 1).trim();
        text = text.slice(0, pipeAt);
        if (text.indexOf('|') > -1) {
          add(lineNo, 'warning', '标签中有多个“|”，只有最后一个会被当作流程状态。', '请移除多余的“|”，或只设置一次状态。');
        }
      }

      if (text.indexOf('->') > -1) {
        add(lineNo, 'warning', '标签中包含“->”，看起来像一条连线。', '请避免在标签中使用箭头语法。');
      }

      if (flowstate && !/^[A-Za-z0-9_-]+$/.test(flowstate)) {
        add(lineNo, 'warning', '流程状态“' + flowstate + '”包含意外字符。', '请使用单个单词，如 `current`。');
      }

      var node = {
        key: key,
        type: type,
        line: lineNo,
        text: text.trim(),
        flowstate: flowstate
      };

      nodes[key] = node;
      nodeList.push(node);
    });

    /* ---- connections ---------------------------------------------------- */
    lines.forEach(function (raw, index) {
      var lineNo = index + 1;
      var line = raw.trim();
      if (!line || /^(\/\/|#)/.test(line)) return;
      if (line.indexOf('=>') > -1) return;
      if (line.indexOf('->') === -1) return;

      var chain = line.split('->').map(parseRef);
      if (chain.length < 2) return;

      chain.forEach(function (ref, i) {
        if (!ref.key) {
          add(lineNo, 'error', '连线缺少节点名。', '请写成 `a->b`，两端都要有名称。');
          return;
        }

        if (!nodes[ref.key]) {
          var keyGuess = suggest(ref.key, Object.keys(nodes));
          add(
            lineNo,
            'error',
            '未知节点“' + ref.key + '”。' + (keyGuess ? '是不是“' + keyGuess + '”？' : ''),
            '请先定义节点，再连接它。'
          );
          return;
        }

        if (i === chain.length - 1) return;

        var node = nodes[ref.key];
        var branch = branchOf(ref.params[0]);
        var target = chain[i + 1].key;
        var dirParam = '';

        if (node.type === 'condition' || node.type === 'parallel') {
          dirParam = ref.params.length > 1 ? branchOf(ref.params[1]) : '';
        } else {
          dirParam = ref.params.length > 0 ? branchOf(ref.params[0]) : '';
        }

        if (node.type === 'condition') {
          if (branch !== 'yes' && branch !== 'no' && branch !== 'true' && branch !== 'false') {
            add(
              lineNo,
              'warning',
              '条件节点“' + ref.key + '”缺少 yes/no 分支。',
              '请写 `' + ref.key + '(yes)->...` 和 `' + ref.key + '(no)->...`。'
            );
          } else {
            var normalized = branch === 'true' ? 'yes' : branch === 'false' ? 'no' : branch;
            var branchKey = ref.key + ':' + normalized;
            if (branchSeen[branchKey]) {
              add(lineNo, 'warning', '“' + ref.key + '”的“' + normalized + '”分支被设置了两次。', '最后一条连线会生效。');
            }
            branchSeen[branchKey] = true;
          }
        } else if (node.type === 'parallel') {
          if (BRANCHES.parallel.indexOf(branch) === -1) {
            add(
              lineNo,
              'warning',
              '并行节点“' + ref.key + '”需要 path1、path2 或 path3。',
              '请写 `' + ref.key + '(path1)->...`。'
            );
          } else {
            var pathKey = ref.key + ':' + branch;
            if (branchSeen[pathKey]) {
              add(lineNo, 'warning', '“' + ref.key + '”的“' + branch + '”路径被设置了两次。', '最后一条连线会生效。');
            }
            branchSeen[pathKey] = true;
          }
        } else if (node.type === 'end') {
          add(lineNo, 'warning', '结束节点“' + ref.key + '”不应有向外的连线。', '结束节点只接收连线。');
        }

        if (dirParam && !DIRECTION_SET[dirParam]) {
          add(lineNo, 'warning', '未知方向“' + dirParam + '”。', '请使用 left、right、top 或 bottom。');
        }

        if (node.type !== 'condition' && node.type !== 'parallel' && ref.params.length > 1) {
          add(lineNo, 'warning', '“' + ref.key + '(' + ref.params.join(', ') + ')”中有多余选项。', '只会读取一个方向。');
        }

        if (target && target === ref.key) {
          add(lineNo, 'warning', '节点“' + ref.key + '”连接到了自己。', '请检查箭头是否指向了新的节点。');
        }

        edges.push({ from: ref.key, to: target, line: lineNo, branch: branch });
      });
    });

    /* ---- style lines ---------------------------------------------------- */
    lines.forEach(function (raw, index) {
      var lineNo = index + 1;
      var line = raw.trim();
      if (!line || /^(\/\/|#)/.test(line)) return;
      if (line.indexOf('=>') > -1 || line.indexOf('->') > -1) return;
      if (line.indexOf('@>') === -1) return;

      var parts = line.split('@>');
      parts.forEach(function (part, i) {
        var ref = parseRef(part);
        if (!ref.key) return;

        if (!nodes[ref.key]) {
          var keyGuess = suggest(ref.key, Object.keys(nodes));
          add(
            lineNo,
            'error',
            '样式行中引用了未知节点“' + ref.key + '”。' + (keyGuess ? '是不是“' + keyGuess + '”？' : ''),
            '样式行只能引用已存在的节点。'
          );
        }

        if (i > 0) {
          var open = part.indexOf('(');
          var close = part.lastIndexOf(')');
          if (open > -1 && close > open) {
            var body = part.slice(open + 1, close).trim();
            if (body) {
              try {
                JSON.parse(body);
              } catch {
                add(lineNo, 'warning', '这一行的样式 JSON 无效。', '键和值请使用双引号，如 {"stroke":"Red"}。');
              }
            }
          }
        }
      });
    });

    /* ---- orphaned text -------------------------------------------------- */
    lines.forEach(function (raw, index) {
      var lineNo = index + 1;
      var line = raw.trim();
      if (!line || /^(\/\/|#)/.test(line)) return;
      if (line.indexOf('=>') > -1 || line.indexOf('->') > -1 || line.indexOf('@>') > -1) return;

      var previous = previousMeaningful(lines, index);
      if (!previous) {
        add(lineNo, 'warning', '这一行不是节点或连线，因此不会被绘制。', '请以 `name=>type: 标签` 开头。');
      } else if (previous.indexOf('->') > -1 && previous.indexOf('=>') === -1) {
        add(lineNo, 'warning', '连线后的文本会被追加到连线中，导致连接失效。', '请把标签移到节点定义上。');
      }
    });

    /* ---- shape of the chart --------------------------------------------- */
    var starts = nodeList.filter(function (n) { return n.type === 'start'; });

    if (nodeList.length > 0) {
      if (starts.length === 0) {
        add(nodeList[0].line, 'warning', '没有找到开始节点。', '请添加 `st=>start: 开始` 并连接到流程。');
      } else if (starts.length > 1) {
        add(starts[1].line, 'warning', '开始节点不止一个。', 'flowchart.js 会从第一条连线中的第一个节点开始。');
      }
    }

    var errorCount = 0;
    issues.forEach(function (issue) {
      if (issue.severity === 'error') errorCount++;
    });

    if (errorCount === 0 && nodeList.length > 0 && starts.length <= 1) {
      var adjacency = Object.create(null);
      edges.forEach(function (edge) {
        if (!adjacency[edge.from]) adjacency[edge.from] = [];
        adjacency[edge.from].push(edge.to);
      });

      var root = starts.length ? starts[0].key : (edges.length ? edges[0].from : nodeList[0].key);
      var seen = Object.create(null);
      var queue = [root];
      seen[root] = true;

      while (queue.length) {
        var current = queue.shift();
        (adjacency[current] || []).forEach(function (next) {
          if (!seen[next]) {
            seen[next] = true;
            queue.push(next);
          }
        });
      }

      var unreachable = nodeList.filter(function (n) { return !seen[n.key]; });
      unreachable.slice(0, 6).forEach(function (n) {
        add(n.line, 'warning', '节点“' + n.key + '”未连接到流程。', '请用 `->` 连接它，或删除它。');
      });
      if (unreachable.length > 6) {
        add(unreachable[6].line, 'warning', '还有 ' + (unreachable.length - 6) + ' 个未连接的节点。', '请检查节点之间的连线。');
      }
    }

    issues.sort(function (a, b) {
      if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1;
      return a.line - b.line;
    });

    var warnings = 0;
    issues.forEach(function (issue) {
      if (issue.severity === 'warning') warnings++;
    });

    return {
      issues: issues,
      errors: errorCount,
      warnings: warnings,
      nodes: nodeList.length,
      links: edges.length
    };
  }

  global.FlowLint = {
    validate: validate,
    stripComments: stripComments
  };
})(window);
