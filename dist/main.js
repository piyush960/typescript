"use strict";
// type aliases
function getColor() {
    const r = Math.floor(Math.random() * 255);
    const g = Math.floor(Math.random() * 255);
    const b = Math.floor(Math.random() * 255);
    return [r, g, b];
}
console.log(getColor());
const userOne = {
    name: 'Alex',
    score: 86
};
const printUser = (user) => {
    console.log(`User is ${user.name} with score ${user.score}`);
};
printUser(userOne);
