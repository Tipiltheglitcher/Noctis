import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

/**
 * Patches @blockshub/pawnote-lts for Pronote 2026+:
 *  1) PageActualites:
 *     - Supports both `listeCategories` (<=2025) and `listeNatures` / `.nature` (2026+)
 *     - Lazy-loads message body / attachments / survey questions via `genreRequeteActualite: 1`
 *       (`tgra_DetailActu`) with defensive `detailsActualite` unwrapping
 *     - Exposes `messagerieDesactivee` (Droit à la déconnexion)
 *  2) ListeMessagerie / ListeMessages / cs() date parser:
 *     - Handles all French PRONOTE date labels (`Aujourd'hui`, `Hier`, `19 nov.`, `HH:MM`, etc.)
 *       without ever throwing and wiping the entire inbox
 *     - Defensive optional chaining on closed discussions / missing buttons / HTML content
 *     - Exposes `messagerieDesactivee` (Droit à la déconnexion)
 */
const OLD_NEWS_BLOCK =
  'dt=(e,s)=>({id:e.N,title:e.L,category:s.find(s=>s.id===e.categorie.V.N),creationDate:le(e.dateCreation.V),startDate:le(e.dateDebut.V),endDate:le(e.dateFin.V),author:e.auteur,public:e.public.V,read:e.lue}),pt=e=>({value:e.L,position:e.rang,isTextInput:!!e.estReponseLibre}),mt=(e,s)=>{const t=e.genreReponse,n=e.reponse.V.avecReponse;let i,a;return n&&e.reponse.V.valeurReponse&&("string"==typeof e.reponse.V.valeurReponse?a=e.reponse.V.valeurReponse:(i=h(e.reponse.V.valeurReponse.V),a=e.reponse.V.valeurReponseLibre)),{id:e.N,fullTitle:e.L,title:e.titre,position:e.rang,kind:t,maximumLength:e.tailleReponse,shouldRespectMaximumChoices:e.avecMaximum,maximumChoices:e.nombreReponsesMax,content:e.texte.V,attachments:e.listePiecesJointes.V.map(e=>De(e,s)),answerID:e.reponse.V.N,answered:n,shouldAnswer:e.reponse.V.estReponseAttendue,answerDate:e.reponse.V.reponduLe?.V&&le(e.reponse.V.reponduLe.V),choices:t===q.TextInput?[]:e.listeChoix.V.map(pt),selectedAnswers:i,textInputAnswer:a}},ht=(e,s,t)=>({is:"information",...dt(e,t),question:mt(e.listeQuestions.V[0],s),get attachments(){return this.question.attachments},get acknowledged(){return this.question.answered},get acknowledgedDate(){return this.question.answerDate},get needToAcknowledge(){return this.question.shouldAnswer},get content(){return this.question.content}}),ft=e=>({id:e.N,name:e.L,default:e.estDefaut??!1}),gt=(e,s,t)=>({is:"survey",...dt(e,t),questions:e.listeQuestions.V.map(e=>mt(e,s)),isAnonymous:e.reponseAnonyme}),Dt=async e=>{const s=ne(e),t=new ae(e,"PageActualites",{[s.signature]:{onglet:Q.News},[s.data]:{modesAffActus:{_T:26,V:at([0])}}});return((e,s)=>{const t=e.listeCategories.V.map(ft);return{categories:t,items:e.listeModesAff[0].listeActualites.V.map(e=>{let n;if(e.estInformation)n=ht;else{if(!e.estSondage)throw new E("decodeNews");n=gt}return n(e,s,t)})}})((await t.send()).data[s.data],e)}';

const NEW_NEWS_BLOCK =
  'dt=(e,s)=>{const _cObj=e.categorie?.V??e.nature?.V??e.listeCategories?.V?.[0];const _cId=_cObj?.N;const _cat=s.find(c=>c.id===_cId)??{id:_cId??"0",name:_cObj?.L??"Information",default:!1};const _dCre=e.dateCreation?.V??e.dateDebut?.V;const _dDeb=e.dateDebut?.V??_dCre;const _dFin=e.dateFin?.V??_dDeb;return{id:e.N,title:e.L??"",category:_cat,creationDate:_dCre?le(_dCre):new Date(),startDate:_dDeb?le(_dDeb):new Date(),endDate:_dFin?le(_dFin):new Date(),author:e.auteur??"Établissement",public:e.public?.V,read:!!e.lue}},pt=e=>({value:e.L??"",position:e.rang??0,isTextInput:!!e.estReponseLibre}),mt=(e,s)=>{if(!e)return{id:"",fullTitle:"",title:"",position:0,kind:0,maximumLength:0,shouldRespectMaximumChoices:!1,maximumChoices:0,content:"",attachments:[],answerID:"",answered:!1,shouldAnswer:!1,choices:[]};const t=e.genreReponse??0,_rep=e.reponse?.V??{},n=!!_rep.avecReponse;let i,a;return n&&_rep.valeurReponse&&("string"==typeof _rep.valeurReponse?a=_rep.valeurReponse:(i=h(_rep.valeurReponse.V??""),a=_rep.valeurReponseLibre)),{id:e.N??"",fullTitle:e.L??"",title:e.titre??"",position:e.rang??0,kind:t,maximumLength:e.tailleReponse??0,shouldRespectMaximumChoices:!!e.avecMaximum,maximumChoices:e.nombreReponsesMax??0,content:typeof e.texte==="string"?e.texte:(e.texte?.V??""),attachments:(e.listePiecesJointes?.V??[]).map(x=>De(x,s)),answerID:_rep.N??"",answered:n,shouldAnswer:!!_rep.estReponseAttendue,answerDate:_rep.reponduLe?.V&&le(_rep.reponduLe.V),choices:t===q.TextInput?[]:(e.listeChoix?.V??[]).map(pt),selectedAnswers:i,textInputAnswer:a}},ht=(e,s,t)=>({is:"information",...dt(e,t),question:mt((e.listeQuestions?.V??e.listeQuestions)?.[0],s),get attachments(){return this.question.attachments},get acknowledged(){return this.question.answered},get acknowledgedDate(){return this.question.answerDate},get needToAcknowledge(){return this.question.shouldAnswer},get content(){return this.question.content}}),ft=e=>({id:e.N,name:e.L,default:e.estDefaut??!1}),gt=(e,s,t)=>({is:"survey",...dt(e,t),questions:(e.listeQuestions?.V??e.listeQuestions??[]).map(x=>mt(x,s)),isAnonymous:!!e.reponseAnonyme}),Dt=async e=>{const s=ne(e),t=new ae(e,"PageActualites",{[s.signature]:{onglet:Q.News},[s.data]:{genreRequeteActualite:0,modesAffActus:{_T:26,V:at([0])}}});return((_res,_sess)=>{const _rawCats=_res.listeCategories?.V??_res.listeNatures?.V??[];const _cats=_rawCats.map(ft);const _mode=_res.listeModesAff?.find(m=>m.G===0)??_res.listeModesAff?.[0];const _rawItems=_mode?.listeActualites?.V??[];return{categories:_cats,messagerieDesactivee:!!_res.messagerieDesactivee,items:_rawItems.map(_raw=>{const _decoded=_raw.estSondage?gt(_raw,_sess,_cats):ht(_raw,_sess,_cats);const _qs=_raw.listeQuestions?.V??_raw.listeQuestions;const _hasDetails=Array.isArray(_qs)&&_qs.length>0;_decoded.__needsDetail=!_hasDetails;_decoded.__fetchDetail=async()=>{const _ds=ne(_sess);const _dreq=new ae(_sess,"PageActualites",{[_ds.signature]:{onglet:Q.News},[_ds.data]:{genreRequeteActualite:1,modeAffActu:0,actualite:_raw}});const _dres=(await _dreq.send()).data[_ds.data];const _det=_dres?.detailsActualite?.V??_dres?.detailsActualite??_dres?.listeModesAff?.[0]?.listeActualites?.V?.[0]??{};const _merged=Object.assign({},_raw,_det);const _full=_merged.estSondage?gt(_merged,_sess,_cats):ht(_merged,_sess,_cats);_full.__needsDetail=!1;return _full};return _decoded})}})((await t.send()).data[s.data],e)}';

const OLD_DISC_BLOCK =
  'function cs(e){const s=new Date,t=["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"],n=e.match(/(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)?\\s*(\\d{1,2})h(\\d{2})/i);if(n){const[,e,i,a]=n,r=parseInt(i),o=parseInt(a),c=new Date(s);if(e){let n=t.indexOf(e.toLowerCase())-s.getDay();c.setDate(s.getDate()+n)}return c.setHours(r,o,0,0),c}const i=e.match(/(\\d{1,2})\\/(\\d{1,2})\\/(\\d{2,4})/);if(i){let[e,s,t,n]=i,a=parseInt(n);return a<100&&(a+=2e3),new Date(a,parseInt(t)-1,parseInt(s))}const a=e.match(/(\\d{1,2})\\/(\\d{1,2})/);if(a){let[e,t,n]=a;const i=new Date(s.getFullYear(),parseInt(n)-1,parseInt(t));return i>s&&i.getTime()-s.getTime()>2592e5&&i.setFullYear(i.getFullYear()-1),i}throw new Error("Couldn\'t convert this label to a date, please open an issue with the label to improve this function.")}var us=e=>({id:e.N,name:e.L,kind:e.G}),ls=async(e,s={_:[]})=>{const t=ne(e),n=new ae(e,"ListeMessagerie",{[t.signature]:{onglet:Q.Discussions},[t.data]:{avecLu:!0,avecMessage:!0,possessionMessageDiscussionUnique:null}}),i=(await n.send()).data[t.data],a=i.listeEtiquettes.V.map(us),r=i.listeMessagerie.V.filter(e=>{const s=0===(e.profondeur||0),t=e.messagePourParticipants?.V.N;return e.estUneDiscussion&&t&&s}).map(e=>((e,s,t)=>({cache:t,creator:e.initiateur,date:cs(e.libelleDate),recipientName:e.public,participantsMessageID:e.messagePourParticipants.V.N,possessions:e.listePossessionsMessages.V,numberOfDrafts:e.nbBrouillons??0,subject:e.objet??"",numberOfMessages:e.nombreMessages??0,numberOfMessagesUnread:e.nbNonLus??0,closed:e.ferme??!1,folders:e.listeEtiquettes?.V.map(e=>s.find(s=>s.id===e.N)).filter(Boolean)??[]}))(e,a,s));s._.length=0,s._.push(...r);for(const e of s._)e.participantsMessageID in s?Object.assign(s[e.participantsMessageID],e):s[e.participantsMessageID]=e;for(const e in s)"_"!==e&&(s._.find(s=>s.participantsMessageID===e)||delete s[e]);return{folders:a,items:s._}},ds=e=>{const s=e.estHTML??!1;return{possessionID:e.possessionMessage.V.N,replyMessageID:e.messageSource.V.N,content:s?e.contenu.V:e.contenu,isHTML:s}},ps=e=>{let s;switch(e){case"Professeur":s=U.Teacher;break;case"Personnel":s=U.Personal;break;default:s=U.Student}return s},ms=(e,s)=>{let t,n;return"Moi"!==e.public_gauche&&(t={name:e.public_gauche,kind:ps(e.hint_gauche)}),"Moi"===e.public_droite?n=void 0:"string"==typeof e.public_droite&&(n={name:e.public_droite,kind:ps(e.hint_droite)}),{id:e.N,content:e.estHTML?e.contenu.V:e.contenu,creationDate:le(e.date.V),author:t,receiver:n,partialVisibility:e.estUnAparte,amountOfRecipients:(e.nbPublic??1)+1,files:e.listeDocumentsJoints?.V.map(e=>De(e,s))??[]}},hs=(e,s,t)=>{const n=[],i=e.messageSource.V.N;if(e.listeMessagesPourContexte)for(const t of e.listeMessagesPourContexte.V){const e=ms(t,s);n.push(e)}let a=t.find(e=>e.id===i);return{...ms(e,s),transferredMessages:n,replyMessageID:i,replyingTo:a}},fs=async(e,s,t=!1)=>{const n=ne(e),i=new ae(e,"ListeMessages",{[n.signature]:{onglet:Q.Discussions},[n.data]:{listePossessionsMessages:s.possessions,marquerCommeLu:t,nbMessagesVus:0}}),a=((e,s)=>{const t=e.brouillon,n=[],i=[],a=e.messagePourReponse.V.N;for(const t of e.listeMessages.V)t.brouillon?i.push(ds(t)):n.push(hs(t,s,n));if(n.sort((e,s)=>s.creationDate.getTime()-e.creationDate.getTime()),t){const e=t.V.estHTML??!1;i.push({isHTML:e,content:e?t.V.contenu:t.V.contenu.V,possessionID:t.V.N,replyMessageID:a})}const r=e.listeBoutons.V.find(e=>e.L.startsWith("Envoyer"))?.G;return{sents:n,drafts:i,defaultReplyMessageID:a,sendAction:r,canIncludeStudentsAndParents:r===T.ReplyEveryoneExceptParentsAndStudents||r===T.SendEveryoneExceptParentsAndStudents}})((await i.send()).data[n.data],e);return s.messages?Object.assign(s.messages,a):s.messages=a,a}';

const NEW_DISC_BLOCK =
  'function cs(e){const s=new Date;if(!e||typeof e!=="string")return s;const _str=e.trim(),_low=_str.toLowerCase();const _hm=_str.match(/(\\d{1,2})[h:](\\d{2})/i);if(_low.includes("aujourd")){const c=new Date(s);return _hm&&c.setHours(+_hm[1],+_hm[2],0,0),c}if(_low.includes("avant-hier")){const c=new Date(s);return c.setDate(c.getDate()-2),_hm&&c.setHours(+_hm[1],+_hm[2],0,0),c}if(_low.includes("hier")){const c=new Date(s);return c.setDate(c.getDate()-1),_hm&&c.setHours(+_hm[1],+_hm[2],0,0),c}const _dmy=_str.match(/(\\d{1,2})\\/(\\d{1,2})\\/(\\d{2,4})/);if(_dmy){let y=parseInt(_dmy[3]);return y<100&&(y+=2e3),new Date(y,parseInt(_dmy[2])-1,parseInt(_dmy[1]),_hm?+_hm[1]:0,_hm?+_hm[2]:0)}const _dm=_str.match(/(\\d{1,2})\\/(\\d{1,2})/);if(_dm){const c=new Date(s.getFullYear(),parseInt(_dm[2])-1,parseInt(_dm[1]),_hm?+_hm[1]:0,_hm?+_hm[2]:0);return c>s&&c.getTime()-s.getTime()>2592e5&&c.setFullYear(c.getFullYear()-1),c}const _months=["janv","fevr","févr","mars","avr","mai","juin","juil","aout","août","sept","oct","nov","dec","déc"];const _mIdx=[0,1,1,2,3,4,5,6,7,7,8,9,10,11,11];const _dMon=_low.match(/(\\d{1,2})\\s+([a-zéû]+)\\.?\\s*(\\d{4})?/);if(_dMon){const mi=_months.findIndex(m=>_dMon[2].startsWith(m));if(mi>=0){const y=_dMon[3]?parseInt(_dMon[3]):s.getFullYear();const c=new Date(y,_mIdx[mi],parseInt(_dMon[1]),_hm?+_hm[1]:0,_hm?+_hm[2]:0);return !_dMon[3]&&c>s&&c.getTime()-s.getTime()>2592e5&&c.setFullYear(c.getFullYear()-1),c}}const _days=["dim","lun","mar","mer","jeu","ven","sam"];const _wd=_low.match(/(dimanche|lundi|mardi|mercredi|jeudi|vendredi|samedi|dim\\.?|lun\\.?|mar\\.?|mer\\.?|jeu\\.?|ven\\.?|sam\\.?)/);if(_wd||_hm){const c=new Date(s);if(_wd){const di=_days.findIndex(d=>_wd[1].startsWith(d));if(di>=0){let diff=di-s.getDay();diff>0&&(diff-=7),c.setDate(s.getDate()+diff)}}return _hm&&c.setHours(+_hm[1],+_hm[2],0,0),c}return s}var us=e=>({id:e.N,name:e.L,kind:e.G}),ls=async(e,s={_:[]})=>{const t=ne(e),n=new ae(e,"ListeMessagerie",{[t.signature]:{onglet:Q.Discussions},[t.data]:{avecLu:!0,avecMessage:!0,possessionMessageDiscussionUnique:null}}),i=(await n.send()).data[t.data]??{},a=(i.listeEtiquettes?.V??[]).map(us),r=(i.listeMessagerie?.V??[]).filter(e=>{const s=0===(e.profondeur||0),t=e.messagePourParticipants?.V?.N;return e.estUneDiscussion&&t&&s}).map(e=>((e,s,t)=>({cache:t,creator:e.initiateur??"",date:cs(e.libelleDate),recipientName:e.public??"",participantsMessageID:e.messagePourParticipants.V.N,possessions:e.listePossessionsMessages?.V??[],numberOfDrafts:e.nbBrouillons??0,subject:e.objet??"",numberOfMessages:e.nombreMessages??0,numberOfMessagesUnread:e.nbNonLus??0,closed:e.ferme??!1,folders:e.listeEtiquettes?.V?.map(e=>s.find(s=>s.id===e.N)).filter(Boolean)??[]}))(e,a,s));s._.length=0,s._.push(...r);for(const e of s._)e.participantsMessageID in s?Object.assign(s[e.participantsMessageID],e):s[e.participantsMessageID]=e;for(const e in s)"_"!==e&&(s._.find(s=>s.participantsMessageID===e)||delete s[e]);return{folders:a,items:s._,messagerieDesactivee:!!i.messagerieDesactivee}},ds=e=>{const s=e.estHTML??!1;return{possessionID:e.possessionMessage?.V?.N??"",replyMessageID:e.messageSource?.V?.N??"",content:typeof e.contenu==="string"?e.contenu:(e.contenu?.V??""),isHTML:s}},ps=e=>{let s;switch(e){case"Professeur":s=U.Teacher;break;case"Personnel":s=U.Personal;break;default:s=U.Student}return s},ms=(e,s)=>{let t,n;return"Moi"!==e.public_gauche&&(t={name:e.public_gauche,kind:ps(e.hint_gauche)}),"Moi"===e.public_droite?n=void 0:"string"==typeof e.public_droite&&(n={name:e.public_droite,kind:ps(e.hint_droite)}),{id:e.N,content:typeof e.contenu==="string"?e.contenu:(e.contenu?.V??""),creationDate:e.date?.V?le(e.date.V):new Date(),author:t,receiver:n,partialVisibility:e.estUnAparte,amountOfRecipients:(e.nbPublic??1)+1,files:e.listeDocumentsJoints?.V?.map(e=>De(e,s))??[]}},hs=(e,s,t)=>{const n=[],i=e.messageSource?.V?.N??"";if(e.listeMessagesPourContexte?.V)for(const t of e.listeMessagesPourContexte.V){const e=ms(t,s);n.push(e)}let a=t.find(e=>e.id===i);return{...ms(e,s),transferredMessages:n,replyMessageID:i,replyingTo:a}},fs=async(e,s,t=!1)=>{const n=ne(e),i=new ae(e,"ListeMessages",{[n.signature]:{onglet:Q.Discussions},[n.data]:{listePossessionsMessages:s.possessions,marquerCommeLu:t,nbMessagesVus:0}}),a=((e,s)=>{const t=e.brouillon,n=[],i=[],a=e.messagePourReponse?.V?.N??"";for(const t of e.listeMessages?.V??[])t.brouillon?i.push(ds(t)):n.push(hs(t,s,n));if(n.sort((e,s)=>s.creationDate.getTime()-e.creationDate.getTime()),t?.V){const e=t.V.estHTML??!1;i.push({isHTML:e,content:typeof t.V.contenu==="string"?t.V.contenu:(t.V.contenu?.V??""),possessionID:t.V.N??"",replyMessageID:a})}const r=e.listeBoutons?.V?.find(e=>e.L?.startsWith("Envoyer"))?.G;return{sents:n,drafts:i,defaultReplyMessageID:a,sendAction:r,canIncludeStudentsAndParents:r===T.ReplyEveryoneExceptParentsAndStudents||r===T.SendEveryoneExceptParentsAndStudents}})((await i.send()).data[n.data]??{},e);return s.messages?Object.assign(s.messages,a):s.messages=a,a}';

const patchPawnote2026Plugin = {
  name: 'patch-pawnote-2026-news-and-discussions',
  setup(build) {
    build.onLoad({ filter: /[\\/]@blockshub[\\/]pawnote-lts[\\/]dist[\\/]index\.(mjs|js)$/ }, async (args) => {
      let contents = await fs.promises.readFile(args.path, 'utf8');

      if (!contents.includes(OLD_NEWS_BLOCK)) {
        throw new Error(
          '[build-electron] Failed to locate Pawnote PageActualites decoder block for 2026 patch!'
        );
      }
      if (!contents.includes(OLD_DISC_BLOCK)) {
        throw new Error(
          '[build-electron] Failed to locate Pawnote ListeMessagerie decoder block for 2026 patch!'
        );
      }

      contents = contents.replace(OLD_NEWS_BLOCK, NEW_NEWS_BLOCK);
      contents = contents.replace(OLD_DISC_BLOCK, NEW_DISC_BLOCK);
      console.log('[build-electron] Applied Pronote 2026 PageActualites + ListeMessagerie patches');
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
