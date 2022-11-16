const express=require('express')
const cors=require('cors')
const { MongoClient, ServerApiVersion } = require('mongodb');

require('dotenv').config()

const port=process.env.PORT || 5000 

const app=express()

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

 async function run(){
    try{
         const appointmentOptionCollection=client.db('doctors-portal').collection('appointmentOptions')
         const bookingCollection=client.db('doctors-portal').collection('bookings')
          
        //  use aggregate to query multiple collection and then merge data
         app.get('/appointmentOptions',async(req,res)=>{

            // get the booking of the provided date
            const date=req.query.date
            const query={}
            const options=await appointmentOptionCollection.find(query).toArray()
            const bookingQuery={appointmentDate:date}
            const alreadyBooked=await bookingCollection.find(bookingQuery).toArray()

            options.forEach(option=>{
                const optionBooked=alreadyBooked.filter(book=>book.treatment===option.name)
                const bookSlots=optionBooked.map(book=>book.slot)
                const remainingSlots=option.slots.filter(slot=>!bookSlots.includes(slot))
                option.slots=remainingSlots 
            })
           
            res.send(options)
         })

         app.post('/bookings',async(req,res)=>{
             const booking=req.body 
             const result=await bookingCollection.insertOne(booking)
             res.send(result) 
         })
    }
    finally{

    }
 }

 run()
 .catch(error=>console.log(error.message))


app.get('/', async(req,res)=>{
    res.send('doctors portal server is running')
})


app.listen(port,()=>{
    console.log(`doctors portal server is running on port ${port}`);
})