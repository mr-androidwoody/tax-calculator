console.log('app loaded');

const runBtn = document.getElementById('runCalculationBtn');
const sampleBtn = document.getElementById('loadSampleBtn');
const toggleBtn = document.getElementById('toggleRawJsonBtn');

console.log({ runBtn, sampleBtn, toggleBtn });

if (runBtn) {
  runBtn.addEventListener('click', () => {
    console.log('run clicked');
  });
}

if (sampleBtn) {
  sampleBtn.addEventListener('click', () => {
    console.log('sample clicked');
  });
}

if (toggleBtn) {
  toggleBtn.addEventListener('click', () => {
    console.log('toggle clicked');
    const panel = document.getElementById('rawJsonPanel');
    if (panel) panel.classList.toggle('hidden');
  });
}
document.body.addEventListener('click', (event) => {
  console.log('body click', event.target);
});