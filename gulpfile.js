/* eslint prefer-arrow-callback: off */

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

gulp.task('build', gulp.series('build-css', 'build-js', 'build-js-utility', 'build-js-vendor'));
gulp.task('default', gulp.series('build', 'watch'));
