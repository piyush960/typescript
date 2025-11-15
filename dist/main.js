"use strict";
// type guards
const swapIdType = (id) => {
    if (typeof id === 'number') {
        return id.toString();
    }
    else {
        return parseInt(id);
    }
};
console.log(swapIdType(1), swapIdType('2'));
const getUser = (user) => {
    if (user.type === 'user') {
        console.log(`User is ${user.userName}`);
    }
    else {
        console.log(`Person is ${user.name}`);
    }
};
const personOne = {
    type: 'person',
    name: 'Sam',
    age: 21,
    id: 1,
};
getUser(personOne);
