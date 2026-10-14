/** Only the current vector space determines ready/failed; historical rows may stay pending. */
export function currentEmbeddingIndex(rows:{fingerprint:string;status:string}[],fingerprint?:string){
  const current=fingerprint?rows.find(row=>row.fingerprint===fingerprint):undefined;
  return {building:rows.some(row=>row.status==='building'),ready:current?.status==='ready',failed:current?.status==='failed'};
}
