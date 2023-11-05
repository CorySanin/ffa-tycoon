document.addEventListener('DOMContentLoaded', function () {
    const app = new PIXI.Application({
        background: '#172323',
        antialias: true,
        resizeTo: window
    });
    document.getElementById('map').appendChild(app.view);

    let texture, parkmap;

    let offset = {
        x: 0,
        y: 0
    }

    let maxValues = {
        x: null,
        y: null
    }

    function loadTexture() {
        texture = PIXI.Texture.from(document.getElementById('parkimg').src);
        texture.on('error', loadTexture);
        if (texture.width) {
            createSprite();
        }
        else {
            texture.on('loaded', createSprite);
        }
    }

    function createSprite() {
        parkmap = new PIXI.Sprite(texture);
        parkmap.anchor.set(.5);
        resetPosition();
        setMaxVals();
        app.stage.addChild(parkmap);

        app.stage.on('pointerdown', startDrag);
        app.stage.on('pointerup', onDragEnd);
        app.stage.on('pointerupoutside', onDragEnd);

        app.view.addEventListener('wheel', event => {
            let pos = {
                x: (parkmap.x - (app.screen.width / 2)) / parkmap.scale.x,
                y: (parkmap.y - (app.screen.height / 2)) / parkmap.scale.y,
            }

            if (event.wheelDeltaY > 0) {
                parkmap.scale.set(Math.min(2, parkmap.scale.x * 2));
            }
            else if (event.wheelDeltaY < 0) {
                if (parkmap.scale.x <= .125) {
                    pos.x = 0;
                    pos.y = 0;
                }
                parkmap.scale.set(Math.max(.125, parkmap.scale.x / 2));
            }
            parkmap.x = (pos.x * parkmap.scale.x) + (app.screen.width / 2);
            parkmap.y = (pos.y * parkmap.scale.y) + (app.screen.height / 2);
            setMaxVals();
            event.preventDefault();
        }, false);

        app.view.addEventListener('contextmenu', event => {
            event.preventDefault();
        }, false);
    }

    function setMaxVals() {
        maxValues.x = parkmap.scale.x / 2 * texture.baseTexture.width;
        maxValues.y = parkmap.scale.y / 2 * texture.baseTexture.height;
    }

    function copyXY(coords) {
        return {
            x: coords.x,
            y: coords.y
        };
    }

    function minMax(val, min, max = null) {
        max = max === null ? -min : max;
        return Math.min(Math.max(val, min), max);
    }

    function resetPosition() {
        parkmap.x = app.screen.width / 2;
        parkmap.y = app.screen.height / 2;
    }

    function startDrag(event) {
        offset = copyXY(event.global);
        if (event.buttons === 2) {
            app.view.requestPointerLock();
            document.addEventListener('mousemove', rcpan);
        }
        else {
            app.stage.on('pointermove', onDragMove);
        }
    }

    function onDragMove(event) {
        parkmap.x += event.global.x - offset.x;
        parkmap.y += event.global.y - offset.y;
        limitTransform();
        offset = copyXY(event.global);
    }

    function rcpan(event) {
        parkmap.x -= event.movementX;
        parkmap.y -= event.movementY;
        limitTransform();
    }

    function limitTransform() {
        if (!(maxValues.x && maxValues.y)) {
            setMaxVals();
        }
        parkmap.x = minMax(parkmap.x, (app.screen.width / 2) - maxValues.x, (app.screen.width / 2) + maxValues.x);
        parkmap.y = minMax(parkmap.y, (app.screen.height / 2) - maxValues.y, (app.screen.height / 2) + maxValues.y);
    }

    function onDragEnd() {
        document.exitPointerLock();
        app.stage.off('pointermove', onDragMove);
        document.removeEventListener('mousemove', rcpan);
    }

    loadTexture();
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;
});