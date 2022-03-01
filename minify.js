const minify = require("html-minifier").minify;
const fs = require("fs");

const options = {
    collapseBooleanAttributes: true,
    collapseInlineTagWhitespace: true,
    collapseWhitespace: true,
    minifyCSS: true,
    minifyJS: true,
    minifyURLs: true,
    removeAttributeQuotes: true,
    removeComments: true,
    removeOptionalTags: true,
    removeRedundantAttributes: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true,
    useShortDoctype: true
};

const input = fs.readFileSync("./lib/index1.js", { encoding: "ascii" });
const res = minify(input, options);

console.log(res);