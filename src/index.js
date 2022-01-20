const path = require('path')
const http = require('http')
const express = require('express')
const socketio = require('socket.io')
const Filter = require('bad-words')
const { generateMessage } = require('./utils/messages')
const { generateLocationMessage } = require('./utils/messages')
const { addUser, getUsersinRoom, getUser, removeUser } = require('./utils/users')

const app = express()
const server = http.createServer(app)
const io = socketio(server)

const port = process.env.PORT || 3000

//Define path for Express config
const publicDirectoryPath = path.join(__dirname, '../public')

// Setup static directory to serve
app.use(express.static(publicDirectoryPath))


//server (emit) -> client (receive) - countUpdated
//client (emit) -> server (receive) - increment
//socket.emit -> message to a singular client
//socket.broadcast -> message to all but joinning client
//io.emit -> message to all clients
//io.to.emit -> message to all in a room
//socket.broadcast.to().emit -> message to all but joinning client in a room


io.on('connection', (socket) =>{
  console.log('New WebSocket connection')

  
  socket.on('join', (options, callback) =>{
    const {error, user} = addUser({id: socket.id, ...options})
    
    if (error) {
      return callback(error)
    }

    socket.join(user.room)

    socket.emit('message',generateMessage('Admin', 'Welcome!'))  //message to a singular client
    socket.broadcast.to(user.room).emit('message', generateMessage('Admin', `${user.username} has joined`))  //message to all but joinning client
    io.to(user.room).emit('roomData', {
      room: user.room,
      users: getUsersinRoom(user.room)
    })


    callback()

  })


  socket.on('sendMessage', (message, callback) => {
      const user = getUser(socket.id)
      const filter = new Filter()
      if (filter.isProfane(message)) {
        return callback('Profanity is not allowed')
      }
      io.to(user.room).emit('message', generateMessage(user.username, message))  // message to all clients
      callback()
  })
  

  socket.on('sendLocation', (coords, callback) =>{
    const user = getUser(socket.id)
    io.to(user.room).emit('locationMessage', generateLocationMessage(user.username, `https://google.com/maps?q=${coords.latitude},${coords.longitude}`))
    callback()
  })

  socket.on('disconnect', () =>{
    const user = removeUser(socket.id)

    if (user) {
      io.to(user.room).emit('message', generateMessage('Admin', `${user.username} has left`))
      io.to(user.room).emit('roomData', {
        room: user.room,
        users: getUsersinRoom(user.room)
      })
    }
  })


})

server.listen(port, () => {
  console.log(`Server is up on port ${port}`)
})
