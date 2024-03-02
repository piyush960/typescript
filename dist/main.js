"use strict";
// functions
Object.defineProperty(exports, "__esModule", { value: true });
function addNums(a, b) {
    return a + b;
}
const subtract = (a, b) => {
    return a - b;
};
const result = subtract(1, 2);
const addAll = (items) => {
    return items.reduce((a, b) => a + b, 0);
};
console.log(addAll([1, 2, 3, 4, 5, 6]));
// return type inference
const getName = (name) => {
    return name;
};
console.log(getName('Katie'));
