const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src/app/[lang]');
const docsDir = path.join(__dirname, '../docs/pages');

if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

const entries = fs.readdirSync(srcDir, { withFileTypes: true });

entries.forEach(entry => {
  if (entry.isDirectory() && entry.name !== 'api') {
    const pageName = entry.name;
    const mdPath = path.join(docsDir, `${pageName}.md`);
    
    if (!fs.existsSync(mdPath)) {
      const content = `# Page: /${pageName}

## Purpose
This page handles the route \`/${pageName}\`.

## Context & Key Components
- Location: \`src/app/[lang]/${pageName}/page.tsx\`
- State Management: 
- Components Used: 
- i18n keys used: 

## Data Fetching
- 

## Notes for AI
- When modifying the \`/${pageName}\` route, make sure to update this document to reflect any new components, state, or context changes.
`;
      fs.writeFileSync(mdPath, content, 'utf8');
      console.log(`Created ${mdPath}`);
    }
  }
});

// Also create home page doc
const homePath = path.join(docsDir, 'home.md');
if (!fs.existsSync(homePath)) {
  const content = `# Page: / (Home)

## Purpose
This is the main landing page of the Labo El Allali PWA.

## Context & Key Components
- Location: \`src/app/[lang]/page.tsx\` and \`src/app/[lang]/HomeClient.tsx\`
- Key Features: Hero Banner, Lab Status (Opening Hours), Main Services, Location Info, Practical Info.
- Components Used: \`HeroBanner\`, \`WhyChooseUs\`, \`MainServices\`, \`LocationInfo\`, \`PracticalInfo\`, \`ContactModal\`.

## Data Fetching
- Client-side lab status checking.

## Notes for AI
- When modifying the home page or \`HomeClient.tsx\`, make sure to update this document to reflect any new components or logic.
`;
  fs.writeFileSync(homePath, content, 'utf8');
  console.log(`Created ${homePath}`);
}
