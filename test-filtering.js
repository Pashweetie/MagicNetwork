// Simple test to verify recommendation filtering
const testFiltering = async () => {
  console.log('Testing recommendation filtering...');
  
  // Test without filters
  const noFiltersResponse = await fetch('http://localhost:5000/api/cards/fbdaa29b-85ff-4a06-b27e-fcdbdfd4a3fe/recommendations?type=synergy&limit=5');
  const noFiltersData = await noFiltersResponse.json();
  console.log(`No filters: ${noFiltersData.length} recommendations`);
  
  // Test with green color filter
  const greenFilterResponse = await fetch('http://localhost:5000/api/cards/fbdaa29b-85ff-4a06-b27e-fcdbdfd4a3fe/recommendations?type=synergy&limit=5&filters=%7B%22colors%22%3A%5B%22G%22%5D%7D');
  const greenFilterData = await greenFilterResponse.json();
  console.log(`Green filter: ${greenFilterData.length} recommendations`);
  
  if (greenFilterData.length > 0) {
    console.log('Sample green card:', greenFilterData[0].card.name, greenFilterData[0].card.colors);
  }
  
  // Test theme filtering
  const themeResponse = await fetch('http://localhost:5000/api/cards/fbdaa29b-85ff-4a06-b27e-fcdbdfd4a3fe/theme-suggestions?filters=%7B%22colors%22%3A%5B%22G%22%5D%7D');
  const themeData = await themeResponse.json();
  console.log(`Theme suggestions: ${themeData.length} themes`);
  
  if (themeData.length > 0 && themeData[0].cards.length > 0) {
    console.log('Sample theme card:', themeData[0].cards[0].name, themeData[0].cards[0].colors);
  }
};

testFiltering().catch(console.error);