const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config()

const port = process.env.PORT || 5000

const app = express()

app.use(cors())
app.use(express.json())


/* 
api naming convention
booking
app.get('/bookings)
app.get('/bookings/:id)
app.post('/bookings)
app.put('/bookings/:id)
app.delete('/bookings/:id)

*/

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.ixgnoqu.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
 

function verifyJWT(req,res,next){
   const authHeader =req.headers.authorization  
   if(!authHeader){
    return res.status(401).send('unauthorized access')
}
const token=authHeader.split(' ')[1];
 jwt.verify(token,process.env.ACCESS_TOKEN, function(error,decoded){
    if(error){
        return res.status(403).send({message:'forbidden access'})
    }
     req.decoded=decoded
     next()
 })
}
async function run() {
    try {
        const appointmentOptionCollection = client.db('doctors-portal').collection('appointmentOptions')
        const bookingCollection = client.db('doctors-portal').collection('bookings')
        const usersCollection = client.db('doctors-portal').collection('users')

        //  use aggregate to query multiple collection and then merge data
        app.get('/appointmentOptions', async (req, res) => {

            // get the booking of the provided date
            const date = req.query.date
            const query = {}
            const options = await appointmentOptionCollection.find(query).toArray()
            const bookingQuery = { appointmentDate: date }
            const alreadyBooked = await bookingCollection.find(bookingQuery).toArray()

            options.forEach(option => {
                const optionBooked = alreadyBooked.filter(book => book.treatment === option.name)
                const bookSlots = optionBooked.map(book => book.slot)
                const remainingSlots = option.slots.filter(slot => !bookSlots.includes(slot))
                option.slots = remainingSlots
            })

            res.send(options)
        })


        //  advance get api
        app.get('/v2/appointmentOptions', async (req, res) => {
            const date = req.query.date
            const options = await appointmentOptionCollection.aggregate([
                {
                    $lookup: {
                        from: 'bookings',
                        localField: 'name',
                        foreignField: 'treatment',
                        pipeline: [
                            {
                                $match:{
                                    $expr:{
                                        $eq:['$appointmentDate',date]
                                    }
                                }
                            }
                        ],
                        as: 'booked'
                    }
                },
                {
                    $project:{
                        name:1,
                        slots:1,
                        booked:{
                            $map:{
                                input:'$booked',
                                as:'book',
                                in:'$$book.slot'
                            }
                        }
                    }
                },
                {
                    $project:{
                        name:1,
                        slots:{
                            $setDifference:['$slots','$booked']
                        }
                    }
                }
            ]).toArray()
            res.send(options)
        })

          
         app.get('/bookings',verifyJWT,async(req,res)=>{
            const email=req.query.email 
            const decodedEmail=req.decoded.email 
            if(email !==decodedEmail){
                return res.status(403).send({message:'forbidden access'})
            }

            const query={
                email:email
            }
            const bookings=await bookingCollection.find(query).toArray()
            res.send(bookings)
         })

        app.post('/bookings', async (req, res) => {
            const booking = req.body
            const query={
                appointmentDate:booking.appointmentDate,
                email:booking.email,
                treatment:booking.treatment

            }

            const alreadyBooked=await bookingCollection.find(query).toArray()
            if(alreadyBooked.length){
                 const message=`You already have a booking on ${booking.appointmentDate}`
                 return res.send({acknowledged:false,message})
            }
            const result = await bookingCollection.insertOne(booking)
            res.send(result)
        });
         
        app.get('/jwt',async(req,res)=>{
            const email=req.query.email
            const query={email:email}
            const user=await usersCollection.findOne(query)
            if(user){
                const token=jwt.sign({email},process.env.ACCESS_TOKEN,{expiresIn:'1d'})
                return res.send({accessToken:token})
            }
            res.status(403).send({accessToken:''})

        })
        app.post('/users',async(req,res)=>{
            const user=req.body
            const result=await usersCollection.insertOne(user)
            res.send(result)
        })
    }
    finally {

    }
}

run()
    .catch(error => console.log(error.message))


app.get('/', async (req, res) => {
    res.send('doctors portal server is running')
})


app.listen(port, () => {
    console.log(`doctors portal server is running on port ${port}`);
})