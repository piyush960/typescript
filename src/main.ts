// type guards

type Id = number | string

const swapIdType = (id: Id) => {
    if(typeof id === 'number'){
        return id.toString();
    }
    else{
        return parseInt(id)
    }
}

console.log(swapIdType(1), swapIdType('2'));

// with interface


interface User {
    type: 'user', // tagging the interface
    userName: string,
    email: string,
    id: Id
}

interface Person {
    type: 'person', // tagging the interface
    name: string,
    age: number,
    id: Id
}

type userType = User | Person

const getUser = (user: userType) => {
    if(user.type === 'user'){
        console.log(`User is ${user.userName}`);
    }
    else{
        console.log(`Person is ${user.name}`);
    }
}

const personOne: Person = {
    type: 'person',
    name: 'Sam',
    age: 21,
    id: 1,
}

getUser(personOne);
