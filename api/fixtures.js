export default async function handler(req,res){
 const key=process.env.APISPORTS_KEY;
 if(!key)return res.status(500).json({error:"Missing APISPORTS_KEY environment variable."});
 const date=typeof req.query.date==="string"?req.query.date:new Date().toISOString().slice(0,10);
 if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(date))return res.status(400).json({error:"Date must use YYYY-MM-DD."});
 try{
  const upstream=await fetch(`https://v3.football.api-sports.io/fixtures?date=${encodeURIComponent(date)}&timezone=Africa%2FLagos`,{headers:{"x-apisports-key":key}});
  const data=await upstream.json();
  if(!upstream.ok)return res.status(upstream.status).json({error:"Football data provider returned an error.",details:data});
  return res.status(200).json({date,results:data.response||[],errors:data.errors||{},provider:"API-Football"});
 }catch(e){return res.status(502).json({error:"Could not reach the football data provider."});}
}