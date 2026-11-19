import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

/**
 * Pronote 2026 changed `PageActualites`:
 *  1) Renamed `listeCategories` -> `listeNatures` and item `.categorie` -> `.nature`
 *  2) Lazy-loads message body / attachments / survey questions via a second `PageActualites`
 *     request with `genreRequeteActualite: 1` (`tgra_DetailActu`), `modeAffActu: 0`, `actualite`.
 * This plugin patches @blockshub/pawnote-lts cleanly during bundling for both <=2025 and 2026+.
 */
const patchPawnote2026Plugin = {
  name: 'patch-pawnote-2026-news',
  setup(build) {
    build.onLoad({ filter: /[\\/]@blockshub[\\/]pawnote-lts[\\/]dist[\\/]index\.(mjs|js)$/ }, async (args) => {
      let contents = await fs.promises.readFile(args.path, 'utf8');

      const oldBlock =
        'dt=(e,s)=>({id:e.N,title:e.L,category:s.find(s=>s.id===e.categorie.V.N),creationDate:le(e.dateCreation.V),startDate:le(e.dateDebut.V),endDate:le(e.dateFin.V),author:e.auteur,public:e.public.V,read:e.lue}),pt=e=>({value:e.L,position:e.rang,isTextInput:!!e.estReponseLibre}),mt=(e,s)=>{const t=e.genreReponse,n=e.reponse.V.avecReponse;let i,a;return n&&e.reponse.V.valeurReponse&&("string"==typeof e.reponse.V.valeurReponse?a=e.reponse.V.valeurReponse:(i=h(e.reponse.V.valeurReponse.V),a=e.reponse.V.valeurReponseLibre)),{id:e.N,fullTitle:e.L,title:e.titre,position:e.rang,kind:t,maximumLength:e.tailleReponse,shouldRespectMaximumChoices:e.avecMaximum,maximumChoices:e.nombreReponsesMax,content:e.texte.V,attachments:e.listePiecesJointes.V.map(e=>De(e,s)),answerID:e.reponse.V.N,answered:n,shouldAnswer:e.reponse.V.estReponseAttendue,answerDate:e.reponse.V.reponduLe?.V&&le(e.reponse.V.reponduLe.V),choices:t===q.TextInput?[]:e.listeChoix.V.map(pt),selectedAnswers:i,textInputAnswer:a}},ht=(e,s,t)=>({is:"information",...dt(e,t),question:mt(e.listeQuestions.V[0],s),get attachments(){return this.question.attachments},get acknowledged(){return this.question.answered},get acknowledgedDate(){return this.question.answerDate},get needToAcknowledge(){return this.question.shouldAnswer},get content(){return this.question.content}}),ft=e=>({id:e.N,name:e.L,default:e.estDefaut??!1}),gt=(e,s,t)=>({is:"survey",...dt(e,t),questions:e.listeQuestions.V.map(e=>mt(e,s)),isAnonymous:e.reponseAnonyme}),Dt=async e=>{const s=ne(e),t=new ae(e,"PageActualites",{[s.signature]:{onglet:Q.News},[s.data]:{modesAffActus:{_T:26,V:at([0])}}});return((e,s)=>{const t=e.listeCategories.V.map(ft);return{categories:t,items:e.listeModesAff[0].listeActualites.V.map(e=>{let n;if(e.estInformation)n=ht;else{if(!e.estSondage)throw new E("decodeNews");n=gt}return n(e,s,t)})}})((await t.send()).data[s.data],e)}';

      const newBlock =
        'dt=(e,s)=>{const _cObj=e.categorie?.V??e.nature?.V??e.listeCategories?.V?.[0];const _cId=_cObj?.N;const _cat=s.find(c=>c.id===_cId)??{id:_cId??"0",name:_cObj?.L??"Information",default:!1};const _dCre=e.dateCreation?.V??e.dateDebut?.V;const _dDeb=e.dateDebut?.V??_dCre;const _dFin=e.dateFin?.V??_dDeb;return{id:e.N,title:e.L??"",category:_cat,creationDate:_dCre?le(_dCre):new Date(),startDate:_dDeb?le(_dDeb):new Date(),endDate:_dFin?le(_dFin):new Date(),author:e.auteur??"Établissement",public:e.public?.V,read:!!e.lue}},pt=e=>({value:e.L??"",position:e.rang??0,isTextInput:!!e.estReponseLibre}),mt=(e,s)=>{if(!e)return{id:"",fullTitle:"",title:"",position:0,kind:0,maximumLength:0,shouldRespectMaximumChoices:!1,maximumChoices:0,content:"",attachments:[],answerID:"",answered:!1,shouldAnswer:!1,choices:[]};const t=e.genreReponse??0,_rep=e.reponse?.V??{},n=!!_rep.avecReponse;let i,a;return n&&_rep.valeurReponse&&("string"==typeof _rep.valeurReponse?a=_rep.valeurReponse:(i=h(_rep.valeurReponse.V??""),a=_rep.valeurReponseLibre)),{id:e.N??"",fullTitle:e.L??"",title:e.titre??"",position:e.rang??0,kind:t,maximumLength:e.tailleReponse??0,shouldRespectMaximumChoices:!!e.avecMaximum,maximumChoices:e.nombreReponsesMax??0,content:e.texte?.V??"",attachments:(e.listePiecesJointes?.V??[]).map(x=>De(x,s)),answerID:_rep.N??"",answered:n,shouldAnswer:!!_rep.estReponseAttendue,answerDate:_rep.reponduLe?.V&&le(_rep.reponduLe.V),choices:t===q.TextInput?[]:(e.listeChoix?.V??[]).map(pt),selectedAnswers:i,textInputAnswer:a}},ht=(e,s,t)=>({is:"information",...dt(e,t),question:mt(e.listeQuestions?.V?.[0],s),get attachments(){return this.question.attachments},get acknowledged(){return this.question.answered},get acknowledgedDate(){return this.question.answerDate},get needToAcknowledge(){return this.question.shouldAnswer},get content(){return this.question.content}}),ft=e=>({id:e.N,name:e.L,default:e.estDefaut??!1}),gt=(e,s,t)=>({is:"survey",...dt(e,t),questions:(e.listeQuestions?.V??[]).map(x=>mt(x,s)),isAnonymous:!!e.reponseAnonyme}),Dt=async e=>{const s=ne(e),t=new ae(e,"PageActualites",{[s.signature]:{onglet:Q.News},[s.data]:{genreRequeteActualite:0,modesAffActus:{_T:26,V:at([0])}}});return((_res,_sess)=>{const _rawCats=_res.listeCategories?.V??_res.listeNatures?.V??[];const _cats=_rawCats.map(ft);const _rawItems=_res.listeModesAff?.[0]?.listeActualites?.V??[];return{categories:_cats,items:_rawItems.map(_raw=>{const _decoded=_raw.estSondage?gt(_raw,_sess,_cats):ht(_raw,_sess,_cats);const _hasDetails=Array.isArray(_raw.listeQuestions?.V)&&_raw.listeQuestions.V.length>0;_decoded.__needsDetail=!_hasDetails;_decoded.__fetchDetail=async()=>{const _ds=ne(_sess);const _dreq=new ae(_sess,"PageActualites",{[_ds.signature]:{onglet:Q.News},[_ds.data]:{genreRequeteActualite:1,modeAffActu:0,actualite:_raw}});const _dres=(await _dreq.send()).data[_ds.data];const _merged=Object.assign({},_raw,_dres?.detailsActualite??{});const _full=_merged.estSondage?gt(_merged,_sess,_cats):ht(_merged,_sess,_cats);_full.__needsDetail=!1;return _full};return _decoded})}})((await t.send()).data[s.data],e)}';

      if (!contents.includes(oldBlock)) {
        throw new Error(
          '[build-electron] Failed to locate Pawnote PageActualites decoder block for 2026 patch!'
        );
      }

      contents = contents.replace(oldBlock, newBlock);
      console.log('[build-electron] Applied Pronote 2026 PageActualites (listeNatures + tgra_DetailActu) patch');
      return { contents, loader: 'js' };
    });
  },
};

async function build() {
  const sharedConfig = {
    bundle: true,
    platform: 'node',
    target: 'node22',
    sourcemap: false,
    external: ['electron'],
  };

  await esbuild.build({
    ...sharedConfig,
    entryPoints: [path.join(rootDir, 'electron/main.ts')],
    outfile: path.join(rootDir, 'dist-electron/main.cjs'),
    format: 'cjs',
    plugins: [patchPawnote2026Plugin],
  });

  await esbuild.build({
    ...sharedConfig,
    entryPoints: [path.join(rootDir, 'electron/preload.ts')],
    outfile: path.join(rootDir, 'dist-electron/preload.cjs'),
    format: 'cjs',
  });

  await esbuild.build({
    ...sharedConfig,
    entryPoints: [path.join(rootDir, 'electron/ent-preload.ts')],
    outfile: path.join(rootDir, 'dist-electron/ent-preload.cjs'),
    format: 'cjs',
  });

  console.log('[build-electron] Built main.cjs, preload.cjs, ent-preload.cjs');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
