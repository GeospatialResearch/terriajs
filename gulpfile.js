/*eslint-env node*/
/*eslint no-sync: 0*/

"use strict";

// Every module required-in here must be a `dependency` in package.json, not just a `devDependency`,
// so that our postinstall script (which runs `gulp post-npm-install`) is able to run without
// the devDependencies available.  Individual tasks, other than `post-npm-install` and any tasks it
// calls, may require in `devDependency` modules locally.
var gulp = require("gulp");
var terriajsServerGulpTask = require("./buildprocess/terriajsServerGulpTask");

gulp.task("build-specs", function (done) {
  var runWebpack = require("./buildprocess/runWebpack.js");
  var webpack = require("webpack");
  var webpackConfig = require("./buildprocess/webpack.config.make.js")(true);

  runWebpack(webpack, webpackConfig, done);
});

gulp.task("release-specs", function (done) {
  var runWebpack = require("./buildprocess/runWebpack.js");
  var webpack = require("webpack");
  var webpackConfig = require("./buildprocess/webpack.config.make.js")(false);

  runWebpack(webpack, webpackConfig, done);
});

gulp.task("watch-specs", function (done) {
  var watchWebpack = require("./buildprocess/watchWebpack");
  var webpack = require("webpack");
  var webpackConfig = require("./buildprocess/webpack.config.make.js")(true);

  watchWebpack(webpack, webpackConfig, done);
});

gulp.task("lint", function (done) {
  var runExternalModule = require("./buildprocess/runExternalModule");
  var path = require("path");

  const eslintDir = path.dirname(require.resolve("eslint/package.json"));
  const eslintExecutable = path.join(eslintDir, "bin", "eslint.js");
  runExternalModule(eslintExecutable, [
    "lib",
    "test",
    "--ext",
    ".jsx,.js,.ts,.tsx",
    "--max-warnings",
    "0",
    "--report-unused-disable-directives"
  ]);

  done();
});

gulp.task("reference-guide", function (done) {
  var runExternalModule = require("./buildprocess/runExternalModule");

  runExternalModule("jsdoc/jsdoc.js", [
    "./lib",
    "-c",
    "./buildprocess/jsdoc.json"
  ]);

  done();
});

gulp.task("copy-cesium-workers", function () {
  var path = require("path");

  var cesiumPackage = require.resolve("terriajs-cesium/package.json");
  var cesiumRoot = path.dirname(cesiumPackage);
  var cesiumWorkersRoot = path.join(cesiumRoot, "Build", "Workers");

  return gulp
    .src([path.join(cesiumWorkersRoot, "**")], {
      base: cesiumWorkersRoot,
      encoding: false
    })
    .pipe(gulp.dest("wwwroot/build/Cesium/build/Workers"));
});

gulp.task("copy-cesium-thirdparty", function () {
  var path = require("path");

  var cesiumPackage = require.resolve("terriajs-cesium/package.json");
  var cesiumRoot = path.dirname(cesiumPackage);
  var cesiumThirdPartyRoot = path.join(cesiumRoot, "Source", "ThirdParty");

  return gulp
    .src([path.join(cesiumThirdPartyRoot, "**")], {
      base: cesiumThirdPartyRoot,
      encoding: false
    })
    .pipe(gulp.dest("wwwroot/build/Cesium/build/ThirdParty"));
});

gulp.task("copy-cesium-source-assets", function () {
  var path = require("path");

  var cesiumPackage = require.resolve("terriajs-cesium/package.json");
  var cesiumRoot = path.dirname(cesiumPackage);
  var cesiumAssetsRoot = path.join(cesiumRoot, "Source", "Assets");

  return gulp
    .src([path.join(cesiumAssetsRoot, "**")], {
      base: cesiumAssetsRoot,
      encoding: false
    })
    .pipe(gulp.dest("wwwroot/build/Cesium/build/Assets"));
});

gulp.task("test-firefox", function (done) {
  runKarma("./buildprocess/karma-firefox.conf.js", done);
});

gulp.task("test", function (done) {
  runKarma("./buildprocess/karma-local.conf.js", done);
});

function runKarma(configFile, done) {
  const { Server } = require("karma");
  const path = require("path");
  const server = new Server(
    {
      configFile: path.join(__dirname, configFile)
    },
    function (e) {
      return done(e);
    }
  );
  server.start();
}

gulp.task("code-attribution", function userAttribution(done) {
  var spawnSync = require("child_process").spawnSync;

  var result = spawnSync(
    "yarn",
    ["licenses generate-disclaimer > doc/acknowledgements/attributions.md"],
    {
      stdio: "inherit",
      shell: true
    }
  );
  if (result.status !== 0) {
    throw new Error(
      "Generating code attribution exited with an error.\n" +
        result.stderr.toString(),
      { showStack: false }
    );
  }
  done();
});

gulp.task("build-for-doc-generation", function buildForDocGeneration(done) {
  var runWebpack = require("./buildprocess/runWebpack.js");
  var webpack = require("webpack");
  var webpackConfig = require("./buildprocess/webpack-tools.config.js")();

  runWebpack(webpack, webpackConfig, done);
});

gulp.task(
  "render-guide",
  gulp.series(
    function copyToBuild(done) {
      const fs = require("node:fs");
      fs.cpSync("doc", "build/doc", { recursive: true });
      done();
    },
    function generateMemberPages(done) {
      const fs = require("node:fs");
      const PluginError = require("plugin-error");
      const spawnSync = require("child_process").spawnSync;

      fs.mkdirSync("build/doc/connecting-to-data/catalog-type-details", {
        recursive: true
      });

      const result = spawnSync("node", ["generateDocs.js"], {
        cwd: "build",
        stdio: "inherit",
        shell: false
      });

      if (result.status !== 0) {
        throw new PluginError(
          "user-doc",
          "Generating catalog members pages exited with an error.",
          { showStack: false }
        );
      }
      done();
    },
    function mkdocs(done) {
      const PluginError = require("plugin-error");
      const spawnSync = require("child_process").spawnSync;

      const result = spawnSync(
        "mkdocs",
        ["build", "--clean", "--config-file", "mkdocs.yml"],
        {
          cwd: "build",
          stdio: "inherit",
          shell: false
        }
      );
      if (result.status !== 0) {
        throw new PluginError(
          "user-doc",
          `Mkdocs exited with an error. Maybe you didn't install mkdocs and other python dependencies in requirements.txt - see https://docs.terria.io/guide/contributing/development-environment/#documentation?`,
          {
            showStack: false
          }
        );
      }
      done();
    }
  )
);

gulp.task(
  "docs",
  gulp.series(
    gulp.parallel("code-attribution", "build-for-doc-generation"),
    "render-guide",
    function docs(done) {
      var fs = require("node:fs");
      fs.cpSync("doc/index-redirect.html", "wwwroot/doc/index.html");
      done();
    }
  )
);

gulp.task("terriajs-server", terriajsServerGulpTask(3002));

gulp.task(
  "copy-cesium-assets",
  gulp.series(
    "copy-cesium-source-assets",
    "copy-cesium-workers",
    "copy-cesium-thirdparty"
  )
);
gulp.task("build", gulp.series("copy-cesium-assets", "build-specs"));
gulp.task("release", gulp.series("copy-cesium-assets", "release-specs"));
gulp.task("watch", gulp.series("copy-cesium-assets", "watch-specs"));
gulp.task("dev", gulp.parallel("terriajs-server", "watch"));
gulp.task("post-npm-install", gulp.series("copy-cesium-assets"));
gulp.task("default", gulp.series("lint", "build"));
