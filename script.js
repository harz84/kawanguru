document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('question-generator-form');
    const generateBtn = document.getElementById('generate-btn');
    const loadingIndicator = document.getElementById('loading-indicator');
    const resultsSection = document.getElementById('results-section');
    const questionsPreview = document.getElementById('questions-preview');
    const errorMessage = document.getElementById('error-message');
    const exportBtn = document.getElementById('export-btn');
    const saveChangesBtn = document.getElementById('save-changes-btn');
    const fileInput = document.getElementById('module-file');

    form.addEventListener('submit', async (event) => {
        event.preventDefault(); // Mencegah form submit standar

        // --- Validasi Sederhana ---
        if (!fileInput.files || fileInput.files.length === 0) {
            showError("Silakan pilih file modul terlebih dahulu.");
            return;
        }
        const selectedFile = fileInput.files[0];
        // Anda bisa menambahkan validasi ukuran file atau tipe di sini jika perlu
        // if (selectedFile.size > MAX_SIZE) { ... }
        // if (!['application/pdf', '...'].includes(selectedFile.type)) { ... }


        // Sembunyikan hasil/error sebelumnya & tampilkan loading
        hideError();
        resultsSection.classList.add('hidden');
        questionsPreview.innerHTML = ''; // Kosongkan preview lama
        loadingIndicator.classList.remove('hidden');
        generateBtn.disabled = true;
        generateBtn.textContent = 'Sedang Membuat...';

        // --- Pengumpulan Data Form ---
        const formData = new FormData();
        formData.append('moduleFile', selectedFile);
        formData.append('difficulty', document.getElementById('difficulty-level').value);
        formData.append('startPage', document.getElementById('start-page').value);
        formData.append('endPage', document.getElementById('end-page').value);
        formData.append('numQuestions', document.getElementById('num-questions').value);
        formData.append('questionType', document.getElementById('question-type').value);


        try {
            // ================================================================
            // === DI SINILAH ANDA AKAN MEMANGGIL BACKEND/API ANDA ===
            // ================================================================
            // Contoh simulasi Panggilan API (gantilah dengan fetch ke backend Anda)
            console.log("Mengirim data ke backend (simulasi):", Object.fromEntries(formData.entries()));
            const response = await simulateApiCall(formData);
            // ================================================================

            displayResults(response.questions); // Tampilkan hasil jika sukses
            resultsSection.classList.remove('hidden');
             exportBtn.classList.remove('hidden'); // Tampilkan tombol export/simpan
             saveChangesBtn.classList.remove('hidden');


        } catch (error) {
            console.error("Error saat membuat soal:", error);
            showError(`Terjadi kesalahan: ${error.message || 'Tidak bisa menghubungi server.'}`);
            resultsSection.classList.add('hidden'); // Sembunyikan section hasil jika error
        } finally {
            // Sembunyikan loading & enable tombol lagi
            loadingIndicator.classList.add('hidden');
            generateBtn.disabled = false;
            generateBtn.textContent = 'Buat Soal';
        }
    });

    // --- Fungsi untuk Menampilkan Hasil ---
    function displayResults(questions) {
        questionsPreview.innerHTML = ''; // Kosongkan dulu

        if (!questions || questions.length === 0) {
            questionsPreview.innerHTML = '<p>Tidak ada soal yang dapat dihasilkan dari modul ini dengan kriteria tersebut.</p>';
            return;
        }

        questions.forEach((q, index) => {
            const questionItem = document.createElement('div');
            questionItem.classList.add('question-item');
            questionItem.setAttribute('data-question-id', q.id || index); // Beri ID unik

            // Kontainer untuk teks soal (agar bisa diedit)
            const textContainer = document.createElement('div');
            textContainer.classList.add('question-text-container');
            textContainer.innerHTML = `<p class="question-text"><strong>${index + 1}.</strong> ${q.text}</p>`; // Tampilkan teks awal
            questionItem.appendChild(textContainer);


             // Tampilkan Opsi jika ada (misal Pilihan Ganda)
            if (q.options && q.options.length > 0) {
                const optionsDiv = document.createElement('div');
                optionsDiv.classList.add('question-options');
                const optionsList = document.createElement('ul');
                q.options.forEach(opt => {
                    const li = document.createElement('li');
                    li.textContent = opt;
                    optionsList.appendChild(li);
                });
                optionsDiv.appendChild(optionsList);
                questionItem.appendChild(optionsDiv);
                // Tambahkan logika untuk mengedit opsi jika diperlukan
            }


            // Tombol Aksi (Edit, Hapus)
            const actionsDiv = document.createElement('div');
            actionsDiv.classList.add('edit-actions');

            const editButton = document.createElement('button');
            editButton.textContent = 'Edit';
            editButton.onclick = () => toggleEditMode(questionItem, q.text);

            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Hapus';
            deleteButton.classList.add('delete');
            deleteButton.onclick = () => {
                 if (confirm('Yakin ingin menghapus soal ini?')) {
                     questionItem.remove();
                     // Nanti tambahkan logika untuk update data jika perlu
                 }
            };

            actionsDiv.appendChild(editButton);
            actionsDiv.appendChild(deleteButton);
            questionItem.appendChild(actionsDiv);

            questionsPreview.appendChild(questionItem);
        });
    }

     // --- Fungsi untuk Mode Edit ---
    function toggleEditMode(questionItem, currentText) {
        const textContainer = questionItem.querySelector('.question-text-container');
        const editButton = questionItem.querySelector('.edit-actions button:not(.delete)'); // Tombol edit/simpan

        const isEditing = textContainer.querySelector('textarea');

        if (isEditing) {
            // --- Sedang dalam mode edit, Simpan Perubahan ---
            const newText = isEditing.value;
            textContainer.innerHTML = `<p class="question-text"><strong>${questionItem.querySelector('.question-text strong').innerHTML}</strong> ${newText}</p>`; // Update tampilan
            editButton.textContent = 'Edit';
            // Di sini Anda bisa menyimpan perubahan ke struktur data JS jika perlu
            // const questionId = questionItem.getAttribute('data-question-id');
            // updateQuestionData(questionId, newText);
        } else {
            // --- Masuk ke mode edit ---
            const questionNumber = questionItem.querySelector('.question-text strong').innerHTML; // Ambil nomor soal
            const currentContent = questionItem.querySelector('.question-text').innerText.replace(questionNumber, '').trim(); // Ambil teks saja

            textContainer.innerHTML = `
                <strong>${questionNumber}</strong>
                <textarea>${currentContent}</textarea>
            `;
            editButton.textContent = 'Simpan';
        }
    }


    // --- Fungsi untuk Menampilkan Error ---
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
    }

    // --- Fungsi untuk Menyembunyikan Error ---
    function hideError() {
        errorMessage.classList.add('hidden');
        errorMessage.textContent = '';
    }

     // --- Fungsi SIMULASI Panggilan API ---
    // GANTI INI DENGAN PANGGILAN FETCH KE BACKEND ANDA YANG SESUNGGUHNYA
    async function simulateApiCall(formData) {
         console.log("Simulating API call...");
         // Mendapatkan detail dari formData (hanya untuk logging simulasi)
         const details = {
             fileName: formData.get('moduleFile').name,
             difficulty: formData.get('difficulty'),
             numQuestions: formData.get('numQuestions'),
             type: formData.get('questionType')
         };
         console.log("Details:", details);

        // Tunggu sebentar untuk simulasi waktu proses
        await new Promise(resolve => setTimeout(resolve, 2500));

        // Simulasi kemungkinan GAGAL
        // if (Math.random() < 0.2) { // 20% chance of failure
        //     throw new Error("Simulasi: Gagal memproses modul di server.");
        // }

        // Simulasi hasil Sukses (data dummy)
        const dummyQuestions = [
            { id: 'q1', text: `Ini adalah contoh soal ${details.type} pertama dengan tingkat ${details.difficulty} dari file ${details.fileName}. Apa konsep utama Bab 1?`, options: ['Konsep A', 'Konsep B', 'Konsep C', 'Konsep D'] },
            { id: 'q2', text: 'Jelaskan proses fotosintesis secara singkat.', options: [] }, // Contoh soal esai
            { id: 'q3', text: 'Benarkah ibu kota Indonesia adalah Jakarta?', options: ['Benar', 'Salah'] }, // Contoh Benar/Salah (bisa dibuat opsi)
            { id: 'q4', text: `Ini adalah contoh soal ${details.type} keempat. Sebutkan 3 komponen penting dalam sel!`, options: ['Nukleus', 'Membran Sel', 'Sitoplasma', 'Jawaban A, B, C benar'] }
        ];

         // Sesuaikan jumlah soal berdasarkan input numQuestions
         const requestedCount = parseInt(details.numQuestions, 10);
         const generatedQuestions = dummyQuestions.slice(0, requestedCount);


        console.log("Simulasi: API call selesai.");
        return {
            success: true,
            questions: generatedQuestions
        };
    }

    // Tambahkan event listener untuk tombol export/save jika diperlukan
    exportBtn.addEventListener('click', () => {
        alert('Fungsi Export belum diimplementasikan. Ini akan mengekspor soal yang ditampilkan.');
        // Logika untuk mengumpulkan data soal dari preview dan mengekspornya (misal: ke CSV, DOCX via library, atau plain text)
    });
     saveChangesBtn.addEventListener('click', () => {
        alert('Fungsi Simpan Perubahan belum diimplementasikan. Ini akan menyimpan hasil editan (misal ke database via API).');
         // Logika untuk mengumpulkan data soal yang sudah diedit dari preview
         // dan mengirimkannya kembali ke backend untuk disimpan.
    });


});
