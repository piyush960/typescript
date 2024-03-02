
const person: [string, number, boolean] = ['Alex', 21, true];

const hsla: [number, string, string, number] = [20, '100%', '50%', 1];

function coordinate(): [number, number]{

    const lat = 100
    const long = 50

    return [lat, long]
}

const coords = coordinate();

// named tuples

let user: [name: string, age: number] 

user = ['Sam', 24];

