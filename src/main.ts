// union types

let userId: number | string;

userId = 1;
userId = '67332'

// with type alias

type Id = number | string

const userIdOne: Id = 1;
const userIdTwo: Id = '1'


// pitfall
const convert = (numId : Id): Id => {
    // can use only properties and method common to both the types (i.e. number | string)
    // parseInt(numId);

    return 1;
}