const rooms = [
    "ზოგადი ჩატი",
    "ვიპ საუბრები",
    "გამოძიება",
    "შიფროგრამა",
    "ვიქტორეინა",
    "ჩამოხრჩობანა",
    "მაფიის ღამე",
    "ჯოკერი",
    "ნარდი",
    "მუსიკა",
    "იუმორი",
    "ადმინისტრაცია",
    "დახმარება",
    "ფორუმი",
    "გასვლა"
];

function displayRooms() {
    const roomsDiv = document.getElementById('rooms');
    roomsDiv.innerHTML = ''; // Clear existing rooms
    rooms.forEach(room => {
        const roomElement = document.createElement('div');
        roomElement.innerText = room;
        roomsDiv.appendChild(roomElement);
    });
}

function createRoom() {
    const roomName = document.getElementById('roomInput').value;
    if (roomName) {
        rooms.push(roomName);
        displayRooms();
        document.getElementById('roomInput').value = ''; // Clear input field
    }
}

// Initial display of rooms
displayRooms();
