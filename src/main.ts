// functions

function addNums(a: number, b: number): number {
    return a+b;
}

const subtract = (a: number, b: number): number => {

    return a-b;
}

const result = subtract(1, 2)

const addAll = (items: number[]): number => {
    return items.reduce((a, b) => a+b, 0);
}

console.log(addAll([1, 2, 3, 4, 5, 6]));

// return type inference

const getName = (name: string) => {
    return name;
}

console.log(getName('Katie'));

export {}