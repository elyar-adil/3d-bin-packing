/*  
    “Commons Clause” License Condition v1.0

    The Software is provided to you by the Licensor under the License, 
    as defined below, subject to the following condition.

    Without limiting other conditions in the License, the grant of rights 
    under the License will not include, and the License does not grant to 
    you, the right to Sell the Software.

    For purposes of the foregoing, “Sell” means practicing any or all of 
    the rights granted to you under the License to provide to third 
    parties, for a fee or other consideration (including without limitation 
    fees for hosting or consulting/ support services related to the 
    Software), a product or service whose value derives, entirely or 
    substantially, from the functionality of the Software. Any license notice
    or attribution required by the License must also include this Commons 
    Clause License Condition notice.
    
    License: GPL-3.0
    Licensor: Elyar Adil
*/


class BinPackingSolver {
    constructor(container, boxes) {
        this.container = container;
        this.unPackedBoxes = [].concat(boxes);
        this.unPackedBoxes.reverse();
    }

    // remove an element of an array
    _removeByIndex(array, index) {
        array.splice(index, 1);
    }

    // change orientaion of box to fit it's position
    _orientBoxToFit(box, xLimit, yLimit) {
        for (var i = 0; i < Box.ORIENTATION_COUNT; i++) {
            box.orientation = i;
            if (this.container.canHold(box)
                && (xLimit == null || box.size.x + box.position.x <= xLimit)
                && (yLimit == null || box.size.y + box.position.y <= yLimit)) {
                return true;
            }
        }
        return false;
    }

    // push 3 new candidate position
    _updateCandidatePositions(candidatePosition, box, oldPositionIndex) {
        if (oldPositionIndex != null)
            this._removeByIndex(candidatePosition, oldPositionIndex);
        candidatePosition.push(new Vector3D(box.position.x + box.size.x, box.position.y, box.position.z));
        candidatePosition.push(new Vector3D(box.position.x, box.position.y + box.size.y, box.position.z));
        candidatePosition.push(new Vector3D(box.position.x, box.position.y, box.position.z + box.size.z));
    }

    solve() {
        var candidatePosition = [new Vector3D(0, 0, 0)];
        var unPackableBoxes = [];

        this.unPackedBoxes.sort(
            (a, b) => {
                var aArray = [a.size.x, a.size.y, a.size.z].sort((a, b) => b - a);
                var bArray = [b.size.x, b.size.y, b.size.z].sort((a, b) => b - a);
                for (var i = 0; i < aArray.length && i < bArray.length; i++) {
                    if (aArray[i] != bArray[i])
                        return aArray[i] - bArray[i];
                }
                return aArray.length - bArray.length;
            }
        );

        var xLimit = 0, yLimit = 0; // y axis points to up
        while (this.unPackedBoxes.length != 0) {
            // pick a box
            var box = this.unPackedBoxes.pop();
            var boxPlaced = false;
            var positionIndex = 0;

            // sort candidatePosition heuristically
            candidatePosition.sort((a, b) => {
                if (a.y != b.y) return a.y - b.y;
                if (a.z != b.z) return a.z - b.z;
                return a.x - b.x;
            });

            // explore candidate position
            for (positionIndex = 0; positionIndex < candidatePosition.length; positionIndex++) {
                box.position = candidatePosition[positionIndex];
                boxPlaced = this._orientBoxToFit(box, xLimit, yLimit);
                if (boxPlaced) {
                    break;
                }
            }
            if (!boxPlaced) {
                positionIndex = null;
                if (xLimit == 0 || xLimit == this.container.size.x) {
                    box.position = new Vector3D(0, yLimit, 0);
                    boxPlaced = this._orientBoxToFit(box);
                    if (boxPlaced) {
                        yLimit = yLimit + box.size.y;
                        xLimit = box.size.x;
                    } else if (yLimit < this.container.size.y) {
                        xLimit = this.container.size.x;
                        yLimit = this.container.size.y;
                        this.unPackedBoxes.push(box);
                    }
                } else {
                    for (positionIndex = 0; positionIndex < candidatePosition.length; positionIndex++) {
                        var p = candidatePosition[positionIndex];
                        if (p.x == xLimit && p.z == 0) {
                            boxPlaced = this._orientBoxToFit(box, null, yLimit);
                            if (boxPlaced) {
                                xLimit = Math.min(xLimit + box.size.x, this.container.size.x);
                            }
                        }
                    }
                    if (!boxPlaced) {
                        xLimit = this.container.size.x;
                        this.unPackedBoxes.push(box);
                    }

                }

            }
            // if limit has reached to container's boundary and not placed
            // than then box doesn't fits into the container
            if (xLimit == this.container.size.x && yLimit == this.container.size.y
                && boxPlaced == false) {
                unPackableBoxes.push(box);
                continue; // skip to next box
            }

            if (boxPlaced == true) {
                var boxMoved = this._moveBoxToShrink(box);
                if (!boxMoved) {
                    positionIndex = null;
                }
                this.container.put(box);
                // remove old candidate position
                this._updateCandidatePositions(candidatePosition, box, positionIndex);
            }
        }
        return unPackableBoxes;
    }


    _moveBoxToShrink(box) {
        var anyMovement = false;
        var boxMoved = false;
        do {
            var moveCount = 0;
            while (this.container.canHold(box)) {
                box.position.y -= 0.01;
                moveCount++;
            }
            box.position.y += 0.01;
            moveCount--;
            while (this.container.canHold(box)) {
                box.position.x -= 0.01;
                moveCount++;
            }
            box.position.x += 0.01;
            moveCount--;
            while (this.container.canHold(box)) {
                box.position.z -= 0.01;
                moveCount++;
            }
            box.position.z += 0.01;
            moveCount--;
            boxMoved = (moveCount != 0);
            if (boxMoved) anyMovement = true;
        } while (boxMoved);
        return anyMovement;
    }
}

class Vector3D {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
}

class Container {
    constructor(width, height, depth) {
        this.size = new Vector3D(width, height, depth);
        this.boxes = new Array();
    }

    makeEmpty() {
        this.boxes = new Array();
    }

    canHold(box) {
        var collide = this.boxes.some(boxInContainer => Box.collide(box, boxInContainer));

        // test whether box collide with container
        if (collide || box.position.x < 0
            || box.position.y < 0
            || box.position.z < 0
            || box.position.x + box.size.x > this.size.x
            || box.position.y + box.size.y > this.size.y
            || box.position.z + box.size.z > this.size.z) {
            return false;
        }
        return true;
    }

    put(box) {
        this.boxes.push(box);
    }
}

class Box {
    static ORIENTATION_COUNT = 6;
    constructor(width, height, depth) {
        this.position = new Vector3D(0, 0, 0);
        this.sizeInAllOrientation = [
            new Vector3D(width, height, depth),
            new Vector3D(width, depth, height),
            new Vector3D(height, width, depth),
            new Vector3D(height, depth, width),
            new Vector3D(depth, width, height),
            new Vector3D(depth, height, width)];

        // prefer orientation with lower height
        this.sizeInAllOrientation.sort((a, b) => (a.y - b.y));

        this.orientation = 0;
        this.size = this.sizeInAllOrientation[0];
    }

    set orientation(o) {
        this._orientation = o;
        this.size = this.sizeInAllOrientation[o];
    }

    get orientation() {
        return this._orientation;
    }

    static collide(a, b) {
        var aCenterX = a.position.x + a.size.x / 2;
        var bCenterX = b.position.x + b.size.x / 2;
        var xDistance = Math.abs(aCenterX - bCenterX);

        var aCenterY = a.position.y + a.size.y / 2;
        var bCenterY = b.position.y + b.size.y / 2;
        var yDistance = Math.abs(aCenterY - bCenterY);

        var aCenterZ = a.position.z + a.size.z / 2;
        var bCenterZ = b.position.z + b.size.z / 2;
        var zDistance = Math.abs(aCenterZ - bCenterZ);

        if (xDistance < (a.size.x + b.size.x) / 2
            && yDistance < (a.size.y + b.size.y) / 2
            && zDistance < (a.size.z + b.size.z) / 2) {
            return true;
        }
        else {
            return false;
        }
    }
}

export { BinPackingSolver, Vector3D, Box, Container }