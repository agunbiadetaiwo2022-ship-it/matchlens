export default async function handler(req,res){
 const key=process.env.APISPORTS_KEY;
 if(!key)return res.status(500).json({error:"Missing APISPORTS_KEY environment variable."});
 const league=String(req.query.league||"");const season=String(req.query.season||"");
 if(!/^\\d+$/.test(league)||!/^\\d{4}$/.test(season))return res.status(400).json({error:"Provide numeric league and four-digit season parameters."});
 try{
  const upstream=await fetch(`https://v3.football.api-sports.io/standings?league=${encodeURIComponent(league)}&season=${encodeURIComponent(season)}`,{headers:{"x-apisports-key":key}});
  const data=await upstream.json();
  if(!upstream.ok)return res.status(upstream.status).json({error:"Football data provider returned an error.",details:data});
  return res.status(200).json({results:data.response||[],errors:data.errors||{},provider:"API-Football"});
 }catch(e){return res.status(502).json({error:"Could not reach the football data provider."});}
}