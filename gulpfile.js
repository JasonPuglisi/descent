/* eslint prefer-arrow-callback: off */

import gulp from 'gulp';
import autoprefixer from 'gulp-autoprefixer';
import browserSyncBase from 'browser-sync';
import nodemon from 'gulp-nodemon';
import * as dartSass from 'sass';
import gulpSass from 'gulp-sass';
import sourcemaps from 'gulp-sourcemaps';
import uglifyBase from 'gulp-uglify-es';

const browserSync = browserSyncBase.create();
const sass = gulpSass(dartSass);
const uglify = uglifyBase.default;

gulp.task('build-css', function(done) {
  gulp.src('source/scss/*.scss')
    .pipe(sourcemaps.init())
    .pipe(sass({ outputStyle: 'compressed' }).on('error', sass.logError))
    .pipe(autoprefixer())
    .pipe(sourcemaps.write('./sourcemaps'))
    .pipe(gulp.dest('public/stylesheets'));

  done();
});

gulp.task('build-js', function(done) {
  gulp.src('source/js/*.js')
    .pipe(sourcemaps.init())
    .pipe(uglify())
    .pipe(sourcemaps.write('./sourcemaps'))
    .pipe(gulp.dest('public/javascripts'));

  done();
});

gulp.task('build-js-utility', function(done) {
  gulp.src('source/js/utility/*.js')
    .pipe(sourcemaps.init())
    .pipe(uglify())
    .pipe(sourcemaps.write('./sourcemaps'))
    .pipe(gulp.dest('public/javascripts/utility'));

  done();
});

gulp.task('sync-css', gulp.series('build-css', function(done) {
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

gulp.task('build', gulp.series('build-css', 'build-js', 'build-js-utility'));
gulp.task('default', gulp.series('build', 'watch'));
