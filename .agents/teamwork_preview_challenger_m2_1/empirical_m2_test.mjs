import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
console.log(`Starting Empirical Verification Harness for Milestone 2... Root: ${ROOT}`);

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

async function runEmpiricalVerification() {
  console.log('\n--- 1. Testing app/layout.js Metadata & Verification ---');
  const layoutPath = path.join(ROOT, 'frontend-next', 'app', 'layout.js');
  const layoutCode = fs.readFileSync(layoutPath, 'utf8');

  const layoutMatch = layoutCode.match(/export const metadata = (\{[\s\S]*?\});\s*export const viewport/);
  assert(layoutMatch !== null, 'layout.js contains valid export const metadata structure matching Next.js App Router rules');

  if (layoutMatch) {
    const SITE_URL = "https://www.openjam.fun";
    let metadata;
    try {
      metadata = eval('(' + layoutMatch[1] + ')');
      assert(true, 'layout.js metadata evaluated without syntax error');
    } catch (e) {
      assert(false, `layout.js metadata eval failed: ${e.message}`);
    }

    if (metadata) {
      assert(Array.isArray(metadata.keywords), 'layout.js metadata.keywords is an array');
      const expectedKeywords = [
        "openjam",
        "listen to music with friends online",
        "shared music listening room",
        "sync youtube music with friends",
        "listen music with friends online free",
        "virtual music room",
        "synced music playback"
      ];
      expectedKeywords.forEach(kw => {
        assert(metadata.keywords.includes(kw), `layout.js keywords includes "${kw}"`);
      });

      assert(metadata.verification !== undefined, 'layout.js metadata contains verification object');
      assert(metadata.verification?.google !== undefined, 'layout.js metadata verification contains google tag');
      assert(metadata.verification?.other?.["msvalidate.01"] !== undefined, 'layout.js metadata verification contains msvalidate.01 tag');

      // Test with environment variables mock
      process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION = "google_test_token_123";
      process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION = "bing_test_token_456";
      const metadataEnv = eval('(' + layoutMatch[1] + ')');
      assert(metadataEnv.verification.google === "google_test_token_123", 'NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION correctly populated in google verification tag');
      assert(metadataEnv.verification.other["msvalidate.01"] === "bing_test_token_456", 'NEXT_PUBLIC_BING_SITE_VERIFICATION correctly populated in msvalidate.01 verification tag');
    }
  }

  console.log('\n--- 2. Testing app/page.js Metadata & Canonical ---');
  const pagePath = path.join(ROOT, 'frontend-next', 'app', 'page.js');
  const pageCode = fs.readFileSync(pagePath, 'utf8');

  const pageMatch = pageCode.match(/export const metadata = (\{[\s\S]*?\});/);
  assert(pageMatch !== null, 'page.js contains valid export const metadata structure');

  if (pageMatch) {
    let pageMeta;
    try {
      pageMeta = eval('(' + pageMatch[1] + ')');
      assert(true, 'page.js metadata evaluated without syntax error');
    } catch (e) {
      assert(false, `page.js metadata eval failed: ${e.message}`);
    }

    if (pageMeta) {
      assert(pageMeta.title.includes('Listen to Music with Friends Online Free'), 'page.js title contains targeted high-intent query');
      assert(pageMeta.alternates?.canonical === 'https://www.openjam.fun', 'page.js canonical alternate URL is correct');
      assert(Array.isArray(pageMeta.keywords), 'page.js keywords is an array');
      assert(pageMeta.keywords.includes('virtual music room'), 'page.js keywords includes "virtual music room"');
      assert(pageMeta.openGraph?.title !== undefined, 'page.js openGraph contains title');
      assert(pageMeta.twitter?.card === 'summary_large_image', 'page.js twitter card set to summary_large_image');
    }
  }

  console.log('\n--- 3. Testing components/JsonLd.js Schema.org Rich Snippets & Parity ---');
  const jsonLdPath = path.join(ROOT, 'frontend-next', 'components', 'JsonLd.js');
  const jsonLdCode = fs.readFileSync(jsonLdPath, 'utf8');
  const jsonLdMatch = jsonLdCode.match(/const jsonLd = (\{[\s\S]*?\});\s*return/);
  assert(jsonLdMatch !== null, 'JsonLd.js contains valid jsonLd object construct');

  if (jsonLdMatch) {
    const SITE_URL = "https://www.openjam.fun";
    let jsonLdObj;
    try {
      jsonLdObj = eval('(' + jsonLdMatch[1] + ')');
      assert(true, 'JsonLd object evaluated without syntax error');
    } catch (e) {
      assert(false, `JsonLd eval failed: ${e.message}`);
    }

    if (jsonLdObj) {
      assert(jsonLdObj["@context"] === "https://schema.org", 'JsonLd context is "https://schema.org"');
      assert(Array.isArray(jsonLdObj["@graph"]), 'JsonLd contains @graph array');

      const graph = jsonLdObj["@graph"];
      const softwareApp = graph.find(item => item["@type"] === "SoftwareApplication");
      assert(softwareApp !== undefined, 'JsonLd @graph includes SoftwareApplication');
      assert(softwareApp?.name === "Open Jam", 'SoftwareApplication name is "Open Jam"');
      assert(softwareApp?.applicationCategory === "MusicApplication", 'SoftwareApplication category is "MusicApplication"');
      assert(softwareApp?.offers?.price === "0" || softwareApp?.offers?.price === 0, 'SoftwareApplication offers price is 0');
      assert(Array.isArray(softwareApp?.featureList), 'SoftwareApplication includes featureList array');

      const faqPage = graph.find(item => item["@type"] === "FAQPage");
      assert(faqPage !== undefined, 'JsonLd @graph includes FAQPage');
      assert(Array.isArray(faqPage?.mainEntity), 'FAQPage contains mainEntity array');
      assert(faqPage?.mainEntity?.length === 5, 'FAQPage mainEntity contains exactly 5 Q&A pairs');

      // Verify FAQ parity with FaqSection.js
      const faqSectionPath = path.join(ROOT, 'frontend-next', 'components', 'FaqSection.js');
      const faqSectionCode = fs.readFileSync(faqSectionPath, 'utf8');
      const faqsMatch = faqSectionCode.match(/const FAQS = (\[[\s\S]*?\]);/);
      assert(faqsMatch !== null, 'FaqSection.js contains FAQS array construct');

      if (faqsMatch) {
        let faqsArray;
        try {
          faqsArray = eval(faqsMatch[1]);
          assert(true, 'FaqSection.js FAQS evaluated successfully');
        } catch (e) {
          assert(false, `FaqSection.js FAQS eval failed: ${e.message}`);
        }

        if (faqsArray && faqPage?.mainEntity) {
          assert(faqsArray.length === faqPage.mainEntity.length, 'FAQ item counts match between FaqSection.js and JsonLd.js');
          let parity = true;
          for (let i = 0; i < faqsArray.length; i++) {
            const uiFaq = faqsArray[i];
            const ldFaq = faqPage.mainEntity[i];
            if (uiFaq.q !== ldFaq.name || uiFaq.a !== ldFaq.acceptedAnswer?.text) {
              parity = false;
              console.error(`  Mismatch at index ${i}: UI Question="${uiFaq.q}", LD Question="${ldFaq.name}"`);
            }
          }
          assert(parity, '100% exact question & answer parity between FaqSection.js and JsonLd.js');
        }
      }
    }
  }

  console.log('\n--- 4. Testing Static Verification Files in frontend-next/public/ ---');
  const googleVerPath = path.join(ROOT, 'frontend-next', 'public', 'google-site-verification.html');
  const bingVerPath = path.join(ROOT, 'frontend-next', 'public', 'BingSiteAuth.xml');

  assert(fs.existsSync(googleVerPath), 'frontend-next/public/google-site-verification.html exists');
  if (fs.existsSync(googleVerPath)) {
    const googleContent = fs.readFileSync(googleVerPath, 'utf8').trim();
    assert(googleContent.includes('google-site-verification'), 'google-site-verification.html contains valid verification string');
  }

  assert(fs.existsSync(bingVerPath), 'frontend-next/public/BingSiteAuth.xml exists');
  if (fs.existsSync(bingVerPath)) {
    const bingContent = fs.readFileSync(bingVerPath, 'utf8').trim();
    assert(bingContent.startsWith('<?xml'), 'BingSiteAuth.xml starts with <?xml declaration');
    assert(bingContent.includes('<users>') && bingContent.includes('</users>'), 'BingSiteAuth.xml contains valid <users> root tags');
    assert(bingContent.includes('<user>') && bingContent.includes('</user>'), 'BingSiteAuth.xml contains valid <user> tag');
  }

  console.log(`\n==================================================`);
  console.log(`Empirical Test Summary: Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
  console.log(`==================================================\n`);

  if (failedTests > 0) {
    process.exit(1);
  }
}

runEmpiricalVerification().catch(err => {
  console.error("Fatal error during empirical test run:", err);
  process.exit(1);
});
