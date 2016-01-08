"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _markdownItLibToken = require("markdown-it/lib/token");

var _markdownItLibToken2 = _interopRequireDefault(_markdownItLibToken);

var TOC = "@[toc]";
var TOC_RE = /^@\[toc\]/im;

var headingIds = {};

var repeat = function repeat(string, num) {
  return new Array(num + 1).join(string);
};

var uslug = require('uslug');
var makeSafe = function makeSafe(string) {
  var key = uslug(string); // slugify
  if (!headingIds[key]) {
    headingIds[key] = 0;
  }
  headingIds[key]++;
  return key + (headingIds[key] > 1 ? "-" + headingIds[key] : "");
};

var getAnchor = function getAnchor(token) {
  if (!token._tocAnchor) {
    token._tocAnchor = makeSafe(token.children.reduce(function (acc, t) {
      return acc + t.content;
    }, ""));
  }

  return token._tocAnchor;
};

var space = function space() {
  return _extends({}, new _markdownItLibToken2["default"]("text", "", 0), { content: " " });
};

var renderAnchorLink = function renderAnchorLink(anchor, options, tokens, idx) {
  var _tokens$children;

  var linkTokens = [_extends({}, new _markdownItLibToken2["default"]("link_open", "a", 1), {
    attrs: [["class", options.anchorClassName], ["href", "#" + anchor]] }), _extends({}, new _markdownItLibToken2["default"]("text", "", 0), {
    content: options.anchorLinkSymbol }), new _markdownItLibToken2["default"]("link_close", "a", -1)];

  // `push` or `unshift` according to anchorLinkBefore option
  // space is at the opposite side.
  var actionOnArray = {
    "false": "push",
    "true": "unshift" };
  linkTokens[actionOnArray[!options.anchorLinkBefore]](space());
  (_tokens$children = tokens[idx + 1].children)[actionOnArray[options.anchorLinkBefore]].apply(_tokens$children, linkTokens);
};

var treeToString = function treeToString(tree, options) {
  var indent = arguments[2] === undefined ? 1 : arguments[2];
  return tree.map(function (item) {
    var node = "\n" + repeat(options.indentation, indent) + "<li>";
    if (item.heading.content) {
      node += "\n" + repeat(options.indentation, indent + 1) + ("<a href=\"#" + item.heading.anchor + "\">" + item.heading.content + "</a>");
    }
    if (item.nodes.length) {
      node += "\n" + repeat(options.indentation, indent + 1) + "<ul>" + treeToString(item.nodes, options, indent + 2) + ("\n" + repeat(options.indentation, indent + 1)) + "</ul>";
    }
    node += "\n" + repeat(options.indentation, indent) + "</li>";
    return node;
  }).join("");
};

exports["default"] = function (md, options) {
  options = _extends({
    toc: true,
    tocClassName: "markdownIt-TOC",
    tocFirstLevel: 1,
    anchorLink: true,
    anchorLinkSymbol: "#",
    anchorLinkBefore: true,
    anchorClassName: "markdownIt-Anchor",
    resetIds: true,
    indentation: "  " }, options);

  var gstate = undefined;

  md.core.ruler.push("grab_state", function (state) {
    gstate = state;
  });

  md.inline.ruler.after("emphasis", "toc", function (state, silent) {
    // reset keys id for each document
    if (options.resetIds) {
      headingIds = {};
    }

    var token = undefined;
    var match = undefined;

    while (state.src.indexOf("\n") >= 0 && state.src.indexOf("\n") < state.src.indexOf(TOC)) {
      if (state.tokens.slice(-1)[0].type === "softbreak") {
        state.src = state.src.split("\n").slice(1).join("\n");
        state.pos = 0;
      }
    }

    if (
    // Reject if the token does not start with @[
    state.src.charCodeAt(state.pos) !== 64 || state.src.charCodeAt(state.pos + 1) !== 91 ||

    // Don’t run any pairs in validation mode
    silent) {
      return false;
    }

    // Detect TOC markdown
    match = TOC_RE.exec(state.src);
    match = !match ? [] : match.filter(function (m) {
      return m;
    });
    if (match.length < 1) {
      return false;
    }

    // Build content
    token = state.push("toc_open", "toc", 1);
    token.markup = TOC;
    token = state.push("toc_body", "", 0);
    token = state.push("toc_close", "toc", -1);

    // Update pos so the parser can continue
    var newline = state.src.indexOf("\n");
    if (newline !== -1) {
      state.pos = state.pos + newline;
    } else {
      state.pos = state.pos + state.posMax + 1;
    }

    return true;
  });

  var originalHeadingOpen = md.renderer.rules.heading_open;
  md.renderer.rules.heading_open = function () {
    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    var tokens = args[0];
    var idx = args[1];
    var self = args[4];

    var attrs = tokens[idx].attrs = tokens[idx].attrs || [];
    var anchor = getAnchor(tokens[idx + 1]);
    attrs.push(["id", anchor]);

    if (options.anchorLink) {
      renderAnchorLink.apply(undefined, [anchor, options].concat(args));
    }

    if (originalHeadingOpen) {
      return originalHeadingOpen.apply(this, args);
    } else {
      return self.renderToken.apply(self, args);
    }
  };

  md.renderer.rules.toc_open = function () {
    return "";
  };
  md.renderer.rules.toc_close = function () {
    return "";
  };
  md.renderer.rules.toc_body = function () {
    return "";
  };

  if (options.toc) {
    md.renderer.rules.toc_body = function () {
      var headings = [];
      var gtokens = gstate.tokens;

      for (var i = 0; i < gtokens.length; i++) {
        if (gtokens[i].type !== "heading_close") {
          continue;
        }
        var token = gtokens[i];
        var heading = gtokens[i - 1];
        if (heading.type === "inline") {
          headings.push({
            level: +token.tag.substr(1, 1),
            anchor: getAnchor(heading),
            content: heading.content });
        }
      }

      var tree = { nodes: [] };
      // create an ast
      headings.forEach(function (heading) {
        if (heading.level < options.tocFirstLevel) {
          return;
        }

        var i = 1;
        var lastItem = tree;
        for (; i < heading.level - options.tocFirstLevel + 1; i++) {
          if (lastItem.nodes.length === 0) {
            lastItem.nodes.push({
              heading: {},
              nodes: [] });
          }
          lastItem = lastItem.nodes[lastItem.nodes.length - 1];
        }
        lastItem.nodes.push({
          heading: heading,
          nodes: [] });
      });

      return "\n<ul class=\"" + options.tocClassName + "\">" + treeToString(tree.nodes, options) + "\n</ul>\n";
    };
  }
};

module.exports = exports["default"];