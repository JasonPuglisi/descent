/* eslint prefer-arrow-callback: off */

import { copyFileSync, cpSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import gulp from 'gulp';
import autoprefixer from 'gulp-autoprefixer';
import browserSyncBase from 'browser-sync';
import nodemon from 'nodemon';
import * as dartSass from 'sass';
import gulpSass from 'gulp-sass';
import uglifyBase from 'gulp-uglify-es';

const browserSync = browserSyncBase.create();
const sass = gulpSass(dartSass);
const uglify = uglifyBase.default;

// While watching, a Sass error should be logged and wait for the next save.
// Anywhere else it has to fail the build, or CI ships a missing stylesheet.
function buildCss(watching) {
  let compile = sass({ outputStyle: 'compressed' });

  if (watching)
    compile.on('error', sass.logError);

  // Returning the stream lets gulp wait for the files to be written, so a
  // dependent task or the build itself can't finish ahead of its output
  return gulp.src('source/scss/*.scss')
    .pipe(compile)
    .pipe(autoprefixer())
    .pipe(gulp.dest('public/stylesheets'));
}

gulp.task('build-css', function() {
  return buildCss(false);
});

gulp.task('build-js', function() {
  return gulp.src('source/js/*.js')
    .pipe(uglify({ module: true }))
    .pipe(gulp.dest('public/javascripts'));
});

gulp.task('build-js-utility', function() {
  return gulp.src('source/js/utility/*.js')
    .pipe(uglify({ module: true }))
    .pipe(gulp.dest('public/javascripts/utility'));
});

// Color Thief ships a single file browser module, so it's copied in next to our
// own modules and served from here rather than a CDN. Dependabot keeps the npm
// package current, and the next build picks the new version up.
gulp.task('build-js-vendor', function() {
  return gulp.src('node_modules/colorthief/dist/index.browser.js')
    .pipe(uglify({ module: true }))
    .pipe(gulp.dest('public/javascripts/vendor/colorthief'));
});

// Fonts and icon fonts, served from here instead of Google Fonts and cdnjs so
// the page loads nothing from a third party. Font Awesome and the text fonts
// come from npm, where Dependabot keeps them current. Weather Icons stopped
// at 2.0.12 and isn't on npm at that version, so its files live in
// source/vendor. These are plain file copies, which gulp.src would mangle as
// text in gulp 5 without extra options.
let textFonts = {
  'noto-serif': ['400'],
  'open-sans': ['300', '400'],
  'oswald': ['700'],
  'source-code-pro': ['400']
};

gulp.task('build-fonts', function(done) {
  let out = 'public/vendor';

  // Each Fontsource weight is a stylesheet of @font-face rules, one per
  // character subset, so the browser only fetches the subsets a page uses.
  // They're joined into one stylesheet pointing at one folder of files.
  mkdirSync(`${out}/fonts/files`, { recursive: true });

  let css = [];

  for (let [name, weights] of Object.entries(textFonts)) {
    let dir = `node_modules/@fontsource/${name}`;

    for (let weight of weights) {
      css.push(readFileSync(`${dir}/${weight}.css`, 'utf8').replaceAll('url(./files/', 'url(files/'));

      for (let file of readdirSync(`${dir}/files`))
        if (file.includes(`-${weight}-normal.`))
          copyFileSync(`${dir}/files/${file}`, `${out}/fonts/files/${file}`);
    }
  }

  writeFileSync(`${out}/fonts/fonts.css`, css.join('\n'));

  let fontAwesome = 'node_modules/@fortawesome/fontawesome-free';
  mkdirSync(`${out}/fontawesome/css`, { recursive: true });
  copyFileSync(`${fontAwesome}/css/all.min.css`, `${out}/fontawesome/css/all.min.css`);
  cpSync(`${fontAwesome}/webfonts`, `${out}/fontawesome/webfonts`, { recursive: true });

  cpSync('source/vendor/weather-icons', `${out}/weather-icons`, { recursive: true });

  done();
});

gulp.task('sync-css', gulp.series(function watchCss() {
  return buildCss(true);
}, function(done) {
  browserSync.reload();

  done();
}));

gulp.task('sync-js', gulp.series('build-js', function(done) {
  browserSync.reload();

  done();
}));

gulp.task('sync-js-utility', gulp.series('build-js-utility', function(done) {
  browserSync.reload();

  done();
}));

gulp.task('reload', function(done) {
  browserSync.reload();

  done();
});

gulp.task('nodemon', function(done) {
  let started = false;
  return nodemon({
    script: './server.js',
    ext: 'js pug',
    ignore: [
      'source/js',
      'public/javascripts'
    ]
  }).on('start', function() {
    if (!started) {
      started = true;
      done();
    }
  });
});

gulp.task('watch', gulp.series('nodemon', function(done) {
  browserSync.init({
    proxy: `localhost:${process.env.DESCENT_PORT || 3000}/`,
    port: 3333
  });

  gulp.watch('source/scss/*.scss', gulp.series('sync-css'));
  gulp.watch('source/js/*.js', gulp.series('sync-js'));
  gulp.watch('source/js/utility/*.js', gulp.series('sync-js-utility'));
  gulp.watch('*.js', gulp.series('reload'));
  gulp.watch('views/*.pug', gulp.series('reload'));
  gulp.watch('views/template/*.pug', gulp.series('reload'));

  done();
}));

gulp.task('build', gulp.series('build-css', 'build-fonts', 'build-js', 'build-js-utility', 'build-js-vendor'));
gulp.task('default', gulp.series('build', 'watch'));
