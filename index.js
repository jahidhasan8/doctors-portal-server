const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion } = require('mongodb');

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

async function run() {
    try {
        const appointmentOptionCollection = client.db('doctors-portal').collection('appointmentOptions')
        const bookingCollection = client.db('doctors-portal').collection('bookings')

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