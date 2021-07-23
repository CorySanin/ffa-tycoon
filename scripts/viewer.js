document.addEventListener('DOMContentLoaded', function () {
    var image = document.getElementById('parkimg');
    var canvas = document.getElementById('map');
    var context = canvas.getContext('2d');
    var position = {
        x: 0,
        y: 0,
        zoom: 1
    }
    var basesize = {
        height: 1,
        width: 1
    }
    var baseposition = {
        x: 0,
        y: 0
    }
    var ratio = 1;
    var windowratio = 1;

    function draw() {
        context.fillStyle = '#172323';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, baseposition.x + position.x * position.zoom, baseposition.y + position.y * position.zoom, basesize.width * position.zoom, basesize.height * position.zoom);
    }

    function updateBasePosition() {
        baseposition.x = (canvas.width - basesize.width * position.zoom) / 2;
        baseposition.y = (canvas.height - basesize.height * position.zoom) / 2;
    }

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight - 6;
        windowratio = canvas.height / canvas.width;
        if (ratio < windowratio) {
            //skinny
            basesize.width = canvas.width;
            basesize.height = ratio * canvas.width;
        }
        else {
            //fat
            basesize.height = canvas.height;
            basesize.width = canvas.height / ratio;
        }
        updateBasePosition();
        draw();
    }

    function imageLoaded() {
        ratio = image.height / image.width;
        resizeCanvas();
    }

    canvas.addEventListener('wheel', e => {
        if (e.wheelDeltaY > 0) {
            position.zoom = Math.min(8, position.zoom * 2);
        }
        else if (e.wheelDeltaY < 0) {
            position.zoom = Math.max(1, position.zoom / 2);
        }
        updateBasePosition();
        if (position.zoom === 1) {
            resetPosition();
        }
        else {
            draw();
        }
        e.preventDefault();
    }, false);

    function lcpan(e) {
        position.x = position.x + e.movementX / position.zoom;
        position.y = position.y + e.movementY / position.zoom;
        draw();
    }

    function rcpan(e) {
        position.x -= e.movementX / position.zoom;
        position.y -= e.movementY / position.zoom;
        draw();
    }

    function startdrag(e) {
        console.log(e);
        if (e.buttons === 1 || e.buttons === 3) {
            document.addEventListener('mousemove', lcpan);
        }
        else if (e.buttons === 2) {
            canvas.requestPointerLock();
            document.addEventListener('mousemove', rcpan);
        }
        else {
            resetPosition();
            e.preventDefault();
        }
    }

    function stopdrag(e) {
        document.exitPointerLock();
        document.removeEventListener('mousemove', lcpan);
        document.removeEventListener('mousemove', rcpan);
    }

    function resetPosition() {
        position.x = 0;
        position.y = 0;
        draw();
    }

    canvas.addEventListener('contextmenu', e => {
        e.preventDefault();
    }, false);
    canvas.addEventListener('mousedown', startdrag);
    document.addEventListener('mouseup', stopdrag);

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    image.addEventListener('load', imageLoaded);
});