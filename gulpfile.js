let gulp         = require('gulp');
let autoprefixer = require('gulp-autoprefixer');
let browserSync  = require('browser-sync').create();
let nodemon      = require('gulp-nodemon');
let sass         = require('gulp-sass');
let sourcemaps   = require('gulp-sourcemaps');
let uglify       = require('gulp-uglify-es').default;

gulp.task('build-css', () => {
  return gulp.src('source/scss/*.scss')
    .pipe(sourcemaps.init())
    .pipe(sass({ outputStyle: 'compressed' }).on('error', sass.logError))
    .pipe(autoprefixer())
    .pipe(sourcemaps.write('./sourcemaps'))
    .pipe(gulp.dest('public/stylesheets'));
});

gulp.task('build-js', () => {
  return gulp.src('source/js/*.js')
    .pipe(sourcemaps.init())
    .pipe(uglify())
    .pipe(sourcemaps.write('./sourcemaps'))
    .pipe(gulp.dest('public/javascripts'));
});

gulp.task('build-js-utility', () => {
  return gulp.src('source/js/utility/*.js')
    .pipe(sourcemaps.init())
    .pipe(uglify())
    .pipe(sourcemaps.write('./sourcemaps'))
    .pipe(gulp.dest('public/javascripts/utility'));
});

gulp.task('sync-css', gulp.series('build-css', () => {
  browserSync.reload();
}));

gulp.task('sync-js', gulp.series('build-js', () => {
  browserSync.reload();
}));

gulp.task('sync-js-utility', gulp.series('build-js-utility', () => {
  browserSync.reload();
}));

gulp.task('reload', () => {
  browserSync.reload();
});

gulp.task('nodemon', callback => {
  let callbackCalled = false;
  return nodemon({
    script: './server.js',
    ext: 'js pug',
    ignore: [
      'source/js',
      'public/javascripts'
    ]
  }).on('start', () => {
    if (!callbackCalled) {
      callbackCalled = true;
      callback();
    }
  });
});

gulp.task('watch', gulp.series('nodemon', () => {
  browserSync.init({
    proxy: `localhost:${process.env.DESCENT_PORT || 3000}/now`,
    port: 3333
  });

  gulp.watch('source/scss/*.scss', gulp.series('sync-css'));
  gulp.watch('source/js/*.js', gulp.series('sync-js'));
  gulp.watch('source/js/utility/*.js', gulp.series('sync-js-utility'));
  gulp.watch('*.js', gulp.series('reload'));
  gulp.watch('views/*.pug', gulp.series('reload'));
}));

gulp.task('build', gulp.series('build-css', 'build-js', 'build-js-utility'));
gulp.task('default', gulp.series('build', 'watch'));
