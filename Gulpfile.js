const gulp = require('gulp');
const sass = require('gulp-sass');
const cleanCSS = require('gulp-clean-css');
const concatCSS = require('gulp-concat-css');
const uglify = require('gulp-uglify');

gulp.task('styles', function(){
    return gulp.src('styles/*.*')
        .pipe(sass().on('error', sass.logError))
        .pipe(concatCSS('styles.css'))
        .pipe(cleanCSS())
        .pipe(gulp.dest('./assets/css/'));
});

gulp.task('scripts', function(){
    return gulp.src('scripts/*.js')
        //.pipe(uglify())
        .pipe(gulp.dest('./assets/js/'));
})

gulp.task('default', gulp.parallel(
    'styles',
    'scripts'
));

gulp.task('watch', function(){
    gulp.watch('styles/*.*', gulp.parallel('styles'));
    gulp.watch('scripts/*.js', gulp.parallel('scripts'));
});