function generateQuestions() {
    // Simulasi hasil dari AI (nanti diganti dengan API call ke Google Gemini)
    const difficulty = document.getElementById('difficulty').value;
    const pageStart = document.getElementById('page-start').value;
    const pageEnd = document.getElementById('page-end').value;

    // Validasi input
    if (!pageStart || !pageEnd) {
        alert('Masukkan range halaman!');
        return;
    }

    // Contoh soal dummy
    const dummyQuestions = [
        `Soal 1 (${difficulty}): Apa ibu kota Indonesia?`,
        `Soal 2 (${difficulty}): Jelaskan siklus air secara singkat.`
    ];

    // Tampilkan soal di preview
    const questionList = document.getElementById('question-list');
    questionList.innerHTML = ''; // Kosongkan dulu

    dummyQuestions.forEach((q, index) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'question';
        questionDiv.innerHTML = `
            ${q}
            <button onclick="editQuestion(${index})">Edit</button>
        `;
        questionList.appendChild(questionDiv);
    });
}

function editQuestion(index) {
    // Logika untuk edit soal (bisa ditambahkan modal atau form)
    alert(`Mengedit soal nomor ${index + 1}`);
    // Nanti tambahkan form untuk mengubah teks soal
}