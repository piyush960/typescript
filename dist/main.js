"use strict";
// union types
let userId;
userId = 1;
userId = '67332';
const userIdOne = 1;
const userIdTwo = '1';
// pitfall
const convert = (numId) => {
    // can use only properties and method common to both the types (i.e. number | string)
    // parseInt(numId);
    return 1;
};
