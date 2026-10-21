# Task337 independent source review of334

## Verdict / exact scope

**SOURCE APPROVE** narrow fixture repair exact `ded97d5c945ab286aa5d53ba5521eb61201f0156` against `4ec8594850eb547dafc145a14bb1b85cdeaa235c`; no blocking code/test design findings or product revision requested. One factual evidence diff-check correction below. Isolated task-337 worktree/branch `tixmo/task-337-review-334`. Reviewer did not author334; owns only this evidence. No DB/services/Jest/build/provider/network operations; QA336 sole active runtime owner, QA338 separate queued fresh acceptance.

## Complete fixture diff assessment

Only implementation change is `tixmoapi2/tests/integration/approvals.test.ts`: import existing uploadService singleton3, then modify final deletion portion of existing curation test567-590. No source/config/schema/lock/unit-test change, no unrelated333 composition. Reviewer blob comparison proves fixture byte-identical to stageA `476faca3fd43a6926a289eb51c2254ea1e9cd98b`; production upload/approval service and both storage unit suites byte-identicalbase.

- Existing curation scenario493-565 retains original registration/organization setup, real upload/create201, initiallynotcurated, noncurator403, ownerpromotion200/approvedBy exactowner, archive200 and default-list exclusion/includeArchived inclusion. Entire before/after diff shows no deleted/weakened role/archive/curation assertions. Original deletion200/body and approvalabsence still retained580-586.
- AssetID567 comes from actual createdrevisionasset; actual Prisma read568-571 obtains persisted private s3Key, not a guessed/publicDTOkey. This preserves existing omission of private storage key from public serialization.
- Exactly one testlocal `jest.spyOn(uploadService,'deleteFile').mockResolvedValue(undefined)`574 installed only immediately before final request. No global mock/beforeAll transport stub or blanket application/authorization/Prisma replacement. The awaited real DELETE HTTP route576-578 still resolves actual actor/tenant permission, executes service delete and DB cascades. Callcount1 + exact persistedkey583 prove intended transport request, not a fabricated success where deleteFile never executes.
- Original server response retained. Actual approval row absence585-586 plus added actual approvalAsset absence587 ensures DB cleanup not replaced by transport mock. This doesn't claim every related cascade/revision/reviewer row checked individually; source handles them and this test asserts two critical rows.
- `try` immediately follows spy installation; any request/assertion failure unwinds589mockRestore. No async gap before enteringtry; privatekeyread happens before spy, so its failure cannot leave installedstub. Awaited route waits through service `Promise.all` for deletions; no deliberate detached deletion callback needs spy after response. No new spy leak into later suites/tests. This fixture is lastcase, but restoration doesn't depend on ordering.

## Correct boundary and unchanged configured behavior

Real `src/api/approvals/service.ts:974-990` resolves actual user, curatorpermission and organizationapproval before deleting row. It captures revisionassetkeys984-986, awaits each uploadService.deleteFile995 inside995-998 existing caught-error boundary, returns id/deleted1002. Stub is narrow transport continuation, not suppression of tenant/database behavior. This fixes local test leakage that formerly could be swallowed without failing assertions.

Production `src/services/upload.service.ts:146-152` still constructs DeleteObjectCommand with configuredbucket/exactkey and awaits client.send; no testfallback or broad production catch added. Existing unit/upload.service.test.ts deleteFile test verifies exactBucket/Key and mockedclient.send; remaining upload/signedURL/delegation tests and unit/upload-cleanup.test.ts request-owned temporary-file cleanup/failure handling unchanged. Those mock configured delegation, not live storage success/provider permission. No claim fixture proves actual object removal or object-store error recovery. Test success intentionally no longer depends on a real storage endpoint.

## Attribution and guarded evidence

Independently read326 `stageB-1/blocked-network.jsonl`: onefreshpre-connectdeny s3.us-east-1.amazonaws.com with exact approvals curationtest context and framesupload.service.ts152→approvals/service.ts995. It supplies fresh attribution supporting this fixture scope. **Does not retroactively attribute318's host-only record** or authorize external storage.334 report correctly distinguishes priorfresh326 attribution.

Raw334 Jest JSON independently recounted:3suites28passed(13approvals+11uploadservice+4cleanup),0failed/skipped/runtimeerrors, notinterrupted; focused.log names exactthreefiles and runTestsByPath, no testnamefilter. Original guardedapproval suite verifies newassertions according toauthor's execution; reviewer did notrerun. Networkverdict zeroattempts/no recordfile/exit0 consistent with retainedmetadata. Lackofrecord plus sourceinspectedguard is Nodeinstrumentation evidence, not proof arbitrarynative trafficblocked or OSsandbox. Bothconfiguredunit suites execute with existing mockedSDK, not providerrequest.

Task jest.config.cjs preserves originalcandidateconfig + tests/setup.ts, adds context.setup.cjs metadata only. Context writes testpath/name/phase, no application behavior imports; afterAll removes PIDfile. Preimportnetworkguard installs unless taskselftestflag set; scrubbed env excludes inheritedflag. Denies nonloopbacknet/TLS/HTTP/fetch before originalconnect; logs sanitizedlocalstack/time/PID/testcontext and throws. Runtime fails on any nonemptyblocklog even when appcatches exception. No guarddisable/loopback widening or testtimeout bypass in fixture.

Runtime read, notrun: env-i beforeimports, synthetickeys/checkpointdisable, freshowned0700diskPG18+RedisDB1, exactPID/exe/user/parent/datadir/listener checks beforeaccess, explicitdisposablevalidation, ownedPrismagenerate+migratedeploy before selectedJest/ordinaryschemabootstrap, boundedcommands/cleanup. Productschema/lockfile unchanged; generatedclient isolatedcopy provenance. Cleanuplog/artifact reports bothservicePIDsabsent, bothportsclosed, pidfiles/sockets/contextfiles/workersgone. This is relianceonauthorartifacts, not newreviewerPIDprobe; independentQA338 stillrequired.

## Actual reviewer checks / evidence correction

Executed read-only gitdiff/show/rg/nl/cat plus Python assertions for all28pass/noskips/runtimeerrors, stageAfixtureidentity, onlyonechangedtestfile, unchangedproduct+unitblobs, recordedzeroattemptverdict. PASS. `bash -n runtime.sh`, `node --check` guard/context/config exit0; source/test-onlydiffcheck `git diff --check4ec85948 ded97d5 -- tixmoapi2/tests/integration/approvals.test.ts` exit0.

**Whole-range diff-check does NOT pass:** actual `git diff --check4ec85948 ded97d5` exits2: `docs/team/evidence/task-334/generate.log:8` newblanklineatEOF; `migrate.log:103` trailingwhitespace. Bothrawtooloutput, not sourceformattingdefect. README's unqualified “diff-checkpass” should be corrected to scopedfixture/sourcePASS + whole-range rawloglimitation, preserving originalrawlogs. No source/testrevision required. Documentation accuracy correction remains before accepting unqualified wholeevidencenarrative.

No nativeprovider/AWS API/credential access, install/clientgeneration/testexecution/service/network or sharedmain changes by reviewer. Sourceapproval only; freshguardedQA338 exactSHA and PMdisposition separate. FullAPI/market/other storagecallpaths, realproviderdeletion and combinedcandidate/release remain unproven.331/335-style limitation: raw executionlogs preserved even if whitespace prevents unqualified diffclean claim.
