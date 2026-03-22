const fs = require('fs');
const path = require('path');

const templateDir = 'c:\\Users\\nicka\\Dev\\keystoneweb\\app\\templates\\master';
const files = fs.readdirSync(templateDir).filter(f => f.endsWith('Template.tsx')).map(f => path.join(templateDir, f));

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  
  const regex = /<img[^>]*src={siteContent\.siteLogo}[^>]*>/g;
  const matches = [...content.matchAll(regex)];
  
  if (matches.length >= 1) {
    let newContent = '';
    let lastIndex = 0;
    
    matches.forEach((match, i) => {
      newContent += content.substring(lastIndex, match.index);
      let tagText = match[0];
      
      const propName = i === 0 ? "headerLogoHeight" : "footerLogoHeight";
      const styleStr = ` style={{ height: siteContent.${propName} ? \`\${siteContent.${propName}}px\` : undefined, width: siteContent.${propName} ? 'auto' : undefined }}`;
      
      if (tagText.includes('/>')) {
        tagText = tagText.replace('/>', `${styleStr} />`);
      } else {
        tagText = tagText.replace('>', `${styleStr}>`);
      }
      
      newContent += tagText;
      lastIndex = match.index + match[0].length;
    });
    
    newContent += content.substring(lastIndex);
    fs.writeFileSync(file, newContent, 'utf-8');
    console.log(`Patched ${path.basename(file)}`);
  } else {
    console.log(`Skipped ${path.basename(file)}`);
  }
}
