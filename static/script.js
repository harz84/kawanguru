document.addEventListener('DOMContentLoaded', () => {
    // --- Referensi Elemen DOM ---
    const form = document.getElementById('question-generator-form');
    const generateBtn = document.getElementById('generate-btn');
    const loadingIndicator = document.getElementById('loading-indicator');
    const resultsSection = document.getElementById('results-section');
    const questionsPreview = document.getElementById('questions-preview');
    const errorMessage = document.getElementById('error-message');
    const exportBtn = document.getElementById('export-btn');
    const saveChangesBtn = document.getElementById('save-changes-btn');
    const fileInput = document.getElementById('module-file');

    // --- Variabel untuk menyimpan data soal yang ditampilkan (penting untuk edit) ---
    let displayedQuestionsData = [];

    // === FUNGSI HELPER untuk Membersihkan Prefix Opsi ===
    /**
     * Menghapus prefix list umum (seperti 'a.', '1)', ' B.') dari awal string.
     * @param {string} text Teks opsi asli.
     * @returns {string} Teks opsi yang sudah dibersihkan.
     */
    function cleanOptionText(text) {
        if (typeof text !== 'string') return text; // Kembalikan jika bukan string
        // Regex: ^\s* : Awal string diikuti 0 atau lebih spasi
        //        [a-zA-Z0-9]+ : Satu atau lebih huruf/angka (untuk a, b, 1, 2, dll.)
        //        [.)] : Diikuti oleh titik atau kurung tutup
        //        \s* : Diikuti oleh 0 atau lebih spasi
        const prefixRegex = /^\s*[a-zA-Z0-9]+[.)]\s*/;
        return text.replace(prefixRegex, '').trim(); // Hapus prefix jika cocok dan trim spasi sisa
    }
    // ========================================================

    // --- Event Listener Utama untuk Form Submission ---
    form.addEventListener('submit', async (event) => {
        event.preventDefault(); // Mencegah reload halaman

        if (!fileInput.files || fileInput.files.length === 0) {
            showError("Silakan pilih file modul terlebih dahulu.");
            return;
        }
        const selectedFile = fileInput.files[0];

        // Reset UI
        hideError();
        resultsSection.classList.add('hidden');
        questionsPreview.innerHTML = '';
        exportBtn.classList.add('hidden');
        saveChangesBtn.classList.add('hidden');
        displayedQuestionsData = []; // Kosongkan data lama
        loadingIndicator.classList.remove('hidden');
        generateBtn.disabled = true;
        generateBtn.textContent = 'Membuat Soal dengan AI...';

        const formData = new FormData();
        formData.append('moduleFile', selectedFile);
        formData.append('difficulty', document.getElementById('difficulty-level').value);
        formData.append('startPage', document.getElementById('start-page').value);
        formData.append('endPage', document.getElementById('end-page').value);
        formData.append('numQuestions', document.getElementById('num-questions').value);
        formData.append('questionType', document.getElementById('question-type').value);

        try {
            console.log("Mengirim FormData ke /generate-soal...");
            // Ganti '/generate-soal' dengan endpoint API Anda yang sebenarnya jika berbeda
            const response = await fetch('/generate-soal', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                let errorMsg = `Error: ${response.status} ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || JSON.stringify(errorData);
                } catch (e) { /* abaikan jika body error bukan json */ }
                throw new Error(errorMsg);
            }

            const result = await response.json();
            console.log("Respons sukses dari backend:", result);

            // Proses Hasil dari Backend
            if (result.error) {
                showError(`Gagal di server: ${result.error}`);
            } else if (result.questions && Array.isArray(result.questions)) {
                hideError();
                // Beri notifikasi sukses jika ada pesan, jika tidak, beri pesan default
                if (result.message) {
                     alert(result.message);
                } else {
                     alert("Soal berhasil dibuat!"); // Pesan default jika tidak ada dari backend
                }


                if (result.questions.length > 0) {
                    // Simpan data soal untuk digunakan saat edit
                    displayedQuestionsData = result.questions;
                    displayResults(displayedQuestionsData); // Tampilkan soal
                    resultsSection.classList.remove('hidden');
                    exportBtn.classList.remove('hidden');
                    saveChangesBtn.classList.remove('hidden');
                } else {
                    showError("Proses AI selesai, namun tidak ada soal yang dihasilkan.");
                }
            } else {
                 console.error("Format respons tidak terduga:", result);
                 showError("Gagal memproses respons server (format tidak dikenali).");
            }

        } catch (error) {
            console.error("Terjadi kesalahan:", error);
            showError(`Gagal: ${error.message}`);
        } finally {
            // Reset UI setelah selesai
            loadingIndicator.classList.add('hidden');
            generateBtn.disabled = false;
            generateBtn.textContent = 'Buat Soal';
        }
    });

    // --- Fungsi untuk Menampilkan Hasil Soal ---
    function displayResults(questions) {
        questionsPreview.innerHTML = ''; // Kosongkan preview sebelum menampilkan yang baru

        if (!questions || questions.length === 0) {
            questionsPreview.innerHTML = '<p>Tidak ada soal untuk ditampilkan.</p>';
            return;
        }

        questions.forEach((q, index) => {
            const questionItem = document.createElement('div');
            questionItem.classList.add('question-item', 'p-4', 'mb-4', 'border', 'border-gray-200', 'rounded-lg', 'shadow-sm', 'bg-white'); // Tambahkan styling Tailwind
            const uniqueId = q.id || `gen-${index}`; // Gunakan ID dari backend jika ada, fallback ke index
            questionItem.setAttribute('data-question-id', uniqueId);

            // Kontainer Teks Pertanyaan
            const textContainer = document.createElement('div');
            textContainer.classList.add('question-text-container', 'mb-3');
            // Tampilkan nomor urut dan teks pertanyaan
            textContainer.innerHTML = `<p class="question-text text-gray-800"><strong class="mr-2">${index + 1}.</strong> ${q.question_text || 'Teks soal tidak ditemukan.'}</p>`;
            questionItem.appendChild(textContainer);

            // Opsi Jawaban (jika Pilihan Ganda)
            if (q.question_type === 'pilihan_ganda' && q.options && Array.isArray(q.options) && q.options.length > 0) {
                const optionsDiv = document.createElement('div');
                optionsDiv.classList.add('question-options', 'pl-5'); // Tambahkan padding kiri untuk opsi
                const optionsList = document.createElement('ul');
                optionsList.classList.add('options-list', 'space-y-1'); // Beri jarak antar opsi
                optionsList.style.listStyleType = 'none'; // Nonaktifkan bullet/number default
                optionsList.style.paddingLeft = '0'; // Reset padding kiri default ul

                const optionLetters = ['a', 'b', 'c', 'd', 'e', 'f']; // Daftar huruf opsi

                q.options.forEach((opt, optIndex) => {
                    const li = document.createElement('li');
                    li.classList.add('flex', 'items-start'); // Gunakan flex untuk alignment
                    const letter = optionLetters[optIndex] || String.fromCharCode(97 + optIndex); // Tentukan huruf opsi (a, b, c, ...)

                    // *** PERBAIKAN UTAMA: Bersihkan teks opsi SEBELUM ditampilkan ***
                    const cleanedOptText = cleanOptionText(opt);

                    // Tampilkan huruf opsi dan teks opsi yang sudah dibersihkan
                    li.innerHTML = `
                        <span class="option-letter font-medium text-gray-700 mr-2">${letter}.</span>
                        <span class="option-text text-gray-700">${cleanedOptText}</span>
                    `;
                    optionsList.appendChild(li);
                });
                optionsDiv.appendChild(optionsList);

                // Tampilkan Jawaban Benar di bawah opsi
                if (q.correct_answer) {
                    // Bersihkan juga teks jawaban benar sebelum mencari index
                    const cleanedCorrectAnswer = cleanOptionText(q.correct_answer);
                    // Cari index berdasarkan TEKS OPSI YANG SUDAH DIBERSIHKAN
                    const correctOptionIndex = q.options.findIndex(opt => cleanOptionText(opt) === cleanedCorrectAnswer);

                    const answerDisplay = document.createElement('p');
                    answerDisplay.classList.add('correct-answer-display', 'text-sm', 'text-green-700', 'mt-2', 'italic'); // Styling untuk jawaban benar

                    if (correctOptionIndex !== -1) {
                        // Jika jawaban benar ditemukan di antara opsi
                        const correctAnswerLetter = optionLetters[correctOptionIndex] || String.fromCharCode(97 + correctOptionIndex);
                        answerDisplay.innerHTML = `Jawaban Benar: ${correctAnswerLetter}`;
                    } else {
                         // Jika teks jawaban benar tidak cocok setelah dibersihkan
                         console.warn(`Jawaban benar "${q.correct_answer}" (setelah dibersihkan jadi "${cleanedCorrectAnswer}") tidak ditemukan di opsi soal ${index + 1}. Menampilkan teks asli.`);
                         answerDisplay.innerHTML = `Jawaban Benar (Teks Asli: ${q.correct_answer}) - Tidak cocok dengan opsi`;
                         answerDisplay.classList.replace('text-green-700', 'text-orange-600'); // Ubah warna jika tidak cocok
                    }
                    optionsDiv.appendChild(answerDisplay); // Tambahkan tampilan jawaban benar ke div opsi
                }
                questionItem.appendChild(optionsDiv); // Tambahkan div opsi ke item soal
            }
            // Tampilkan jawaban tipe lain jika perlu (contoh: Benar/Salah)
            else if (q.question_type === 'benar_salah' && q.correct_answer) {
                 const answerDiv = document.createElement('div');
                 answerDiv.classList.add('correct-answer-display', 'pl-5', 'mt-2'); // Styling
                 answerDiv.innerHTML = `<p class="text-sm text-gray-600"><i>Jawaban: ${q.correct_answer}</i></p>`;
                 questionItem.appendChild(answerDiv);
            }
            // Tambahkan penanganan untuk tipe soal lain jika ada (misal: Isian Singkat)
            else if (q.question_type === 'isian_singkat' && q.correct_answer) {
                 const answerDiv = document.createElement('div');
                 answerDiv.classList.add('correct-answer-display', 'pl-5', 'mt-2');
                 answerDiv.innerHTML = `<p class="text-sm text-gray-600"><i>Kunci Jawaban: ${q.correct_answer}</i></p>`;
                 questionItem.appendChild(answerDiv);
            }


            // Tombol Aksi (Edit & Hapus)
            const actionsDiv = document.createElement('div');
            actionsDiv.classList.add('edit-actions', 'mt-3', 'flex', 'space-x-2', 'justify-end'); // Styling tombol aksi

            const editButton = document.createElement('button');
            editButton.textContent = 'Edit';
            editButton.classList.add('px-3', 'py-1', 'text-sm', 'bg-blue-500', 'text-white', 'rounded', 'hover:bg-blue-600', 'transition-colors');
            editButton.onclick = () => toggleEditMode(questionItem); // Panggil fungsi edit saat diklik

            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Hapus';
            deleteButton.classList.add('delete', 'px-3', 'py-1', 'text-sm', 'bg-red-500', 'text-white', 'rounded', 'hover:bg-red-600', 'transition-colors');
            deleteButton.onclick = () => {
                 // Konfirmasi sebelum menghapus
                 if (confirm('Yakin ingin menghapus soal ini? Tindakan ini tidak dapat dibatalkan.')) {
                     const qId = questionItem.getAttribute('data-question-id');
                     // Hapus soal dari array data di memori
                     displayedQuestionsData = displayedQuestionsData.filter((item, idx) => (item.id || `gen-${idx}`) !== qId);
                     // Hapus elemen soal dari tampilan DOM
                     questionItem.remove();
                     // Optional: Update nomor urut soal yang tersisa secara visual
                     updateQuestionNumbers();
                     // Beri tahu pengguna
                     // alert('Soal berhasil dihapus.'); // Mungkin tidak perlu alert jika visualnya jelas
                     console.log(`Soal dengan ID ${qId} dihapus.`);
                     // Jika tidak ada soal tersisa, sembunyikan tombol aksi global
                     if (displayedQuestionsData.length === 0) {
                         resultsSection.classList.add('hidden');
                         exportBtn.classList.add('hidden');
                         saveChangesBtn.classList.add('hidden');
                     }
                 }
            };
            actionsDiv.appendChild(editButton);
            actionsDiv.appendChild(deleteButton);
            questionItem.appendChild(actionsDiv); // Tambahkan tombol aksi ke item soal

            questionsPreview.appendChild(questionItem); // Tambahkan item soal ke kontainer preview
        });
    }

    // --- Fungsi untuk Memperbarui Nomor Urut Soal di Tampilan ---
    function updateQuestionNumbers() {
        const questionItems = questionsPreview.querySelectorAll('.question-item');
        questionItems.forEach((item, index) => {
            const numberElement = item.querySelector('.question-text strong');
            if (numberElement) {
                numberElement.textContent = `${index + 1}.`;
            }
        });
    }


     // --- Fungsi untuk Mengaktifkan/Menonaktifkan Mode Edit Soal ---
    function toggleEditMode(questionItem) {
        const questionId = questionItem.getAttribute('data-question-id');
        // Cari index soal dalam array data berdasarkan ID
        const questionDataIndex = displayedQuestionsData.findIndex((q, idx) => (q.id || `gen-${idx}`) === questionId);

        if (questionDataIndex === -1) {
            console.error("Data soal tidak ditemukan untuk ID:", questionId);
            alert("Gagal memulai edit: data soal tidak ditemukan.");
            return;
        }
        const questionData = displayedQuestionsData[questionDataIndex]; // Akses data soal yang akan diedit

        const textContainer = questionItem.querySelector('.question-text-container');
        const optionsDiv = questionItem.querySelector('.question-options'); // Mungkin null jika bukan PG
        const actionsDiv = questionItem.querySelector('.edit-actions');
        const editButton = actionsDiv.querySelector('button:not(.delete)'); // Tombol Edit/Simpan
        const isEditing = questionItem.classList.contains('is-editing'); // Cek apakah sedang dalam mode edit

        if (isEditing) {
            // --- KELUAR DARI MODE EDIT (SIMPAN PERUBAHAN LOKAL) ---
            const questionTextArea = textContainer.querySelector('textarea.edit-textarea');
            // Ambil teks pertanyaan baru dari textarea, atau gunakan yang lama jika textarea tidak ada
            const newQuestionText = questionTextArea ? questionTextArea.value.trim() : questionData.question_text;

            // Kembalikan tampilan teks pertanyaan
            const questionNumberStrong = textContainer.querySelector('strong'); // Simpan nomornya
            textContainer.innerHTML = `<p class="question-text text-gray-800">${questionNumberStrong ? questionNumberStrong.outerHTML : ''} ${newQuestionText}</p>`;

            // Update data pertanyaan di array utama (di memori)
            displayedQuestionsData[questionDataIndex].question_text = newQuestionText;

            // Jika Pilihan Ganda, simpan opsi yang diedit
            if (questionData.question_type === 'pilihan_ganda' && optionsDiv) {
                const optionInputs = optionsDiv.querySelectorAll('input.edit-option-input');
                const optionsList = optionsDiv.querySelector('ul.options-list');
                const optionLetters = ['a', 'b', 'c', 'd', 'e', 'f'];
                const newOptionsData = []; // Array untuk menyimpan teks opsi baru yang sudah bersih

                optionsList.innerHTML = ''; // Kosongkan list yang berisi input

                optionInputs.forEach((input, index) => {
                     // Ambil teks dari input (diasumsikan sudah bersih karena dimasukkan user)
                     const editedOptionText = input.value.trim();
                     newOptionsData.push(editedOptionText); // Simpan teks baru (bersih) ke data

                     // Buat ulang tampilan list item (li) dengan teks bersih
                     const li = document.createElement('li');
                     li.classList.add('flex', 'items-start');
                     const letter = optionLetters[index] || String.fromCharCode(97 + index);
                     li.innerHTML = `
                        <span class="option-letter font-medium text-gray-700 mr-2">${letter}.</span>
                        <span class="option-text text-gray-700">${editedOptionText}</span>
                     `;
                     optionsList.appendChild(li);
                });

                // Update data opsi di array utama
                displayedQuestionsData[questionDataIndex].options = newOptionsData;

                // Tampilkan kembali info jawaban benar (sesuaikan dengan data baru)
                 const answerDisplay = optionsDiv.querySelector('.correct-answer-display');
                 if (answerDisplay) {
                     // Gunakan teks jawaban benar yg bersih & cari di opsi baru yg bersih
                     // Penting: Asumsikan questionData.correct_answer TIDAK berubah saat edit opsi.
                     // Jika jawaban benar bisa diedit, perlu input terpisah.
                     const cleanedCorrectAnswer = cleanOptionText(questionData.correct_answer); // Pastikan jawaban benar (dari data asli) juga bersih
                     // Cari di opsi BARU (yg sudah bersih dari inputan user)
                     const correctOptionIndex = newOptionsData.findIndex(opt => opt === cleanedCorrectAnswer);

                     if (correctOptionIndex !== -1) {
                        const correctAnswerLetter = optionLetters[correctOptionIndex] || String.fromCharCode(97 + correctOptionIndex);
                        answerDisplay.innerHTML = `Jawaban Benar: ${correctAnswerLetter}`;
                        answerDisplay.className = 'correct-answer-display text-sm text-green-700 mt-2 italic'; // Reset class
                     } else {
                        // Jika tetap tidak ketemu setelah diedit & dibersihkan
                        answerDisplay.innerHTML = `Jawaban Benar (Teks Asli: ${questionData.correct_answer}) - Tidak cocok dengan opsi`;
                        answerDisplay.className = 'correct-answer-display text-sm text-orange-600 mt-2 italic'; // Warning class
                     }
                     answerDisplay.style.display = ''; // Tampilkan lagi elemen jawaban benar
                     optionsDiv.appendChild(answerDisplay); // Pastikan elemennya ada di DOM lagi
                 }
            }
            // Handle penyimpanan untuk tipe soal lain jika diperlukan

            editButton.textContent = 'Edit'; // Ubah teks tombol kembali ke 'Edit'
            editButton.classList.replace('bg-green-500', 'bg-blue-500'); // Kembalikan warna tombol
            editButton.classList.replace('hover:bg-green-600', 'hover:bg-blue-600');
            questionItem.classList.remove('is-editing'); // Hapus class penanda mode edit
            console.log("Data Soal Diperbarui (di memori):", displayedQuestionsData[questionDataIndex]);

        } else {
            // --- MASUK KE MODE EDIT ---
            const questionNumberStrong = textContainer.querySelector('.question-text strong'); // Ambil elemen nomor
            const currentQuestionText = questionData.question_text; // Ambil teks pertanyaan saat ini dari data

            // Ganti paragraf pertanyaan dengan textarea
            textContainer.innerHTML = `
                ${questionNumberStrong ? questionNumberStrong.outerHTML : ''}
                <textarea class="edit-textarea form-textarea mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" rows="3">${currentQuestionText}</textarea>
            `;

            // Jika Pilihan Ganda, buat opsi jadi input
            if (questionData.question_type === 'pilihan_ganda' && optionsDiv) {
                const optionsList = optionsDiv.querySelector('ul.options-list');
                const currentOptions = questionData.options || []; // Ambil opsi saat ini dari data
                const answerDisplay = optionsDiv.querySelector('.correct-answer-display');

                optionsList.innerHTML = ''; // Kosongkan list tampilan opsi

                currentOptions.forEach((optText, index) => {
                    const letter = ['a', 'b', 'c', 'd', 'e', 'f'][index] || String.fromCharCode(97 + index);

                    const inputLi = document.createElement('li');
                    inputLi.classList.add('flex', 'items-center', 'mb-2'); // Styling untuk item input

                    const input = document.createElement('input');
                    input.type = 'text';
                    // *** PENTING: Isi input dengan teks opsi yang SUDAH DIBERSIHKAN ***
                    input.value = cleanOptionText(optText); // Gunakan teks bersih sebagai nilai awal
                    input.classList.add('edit-option-input', 'form-input', 'block', 'w-full', 'ml-2', 'border', 'border-gray-300', 'rounded-md', 'shadow-sm', 'text-sm'); // Styling input
                    input.setAttribute('data-original-index', index.toString()); // Simpan index asli jika perlu

                    inputLi.innerHTML = `<span class="option-letter font-medium text-gray-700">${letter}.</span>`;
                    inputLi.appendChild(input);
                    optionsList.appendChild(inputLi);
                });

                 // Sembunyikan info jawaban benar selama edit opsi
                 if (answerDisplay) answerDisplay.style.display = 'none';
            }
            // Handle tampilan edit untuk tipe soal lain jika diperlukan

            const textarea = textContainer.querySelector('textarea.edit-textarea');
            if(textarea) textarea.focus(); // Fokus ke textarea pertanyaan
            editButton.textContent = 'Simpan'; // Ubah teks tombol menjadi 'Simpan'
            editButton.classList.replace('bg-blue-500', 'bg-green-500'); // Ubah warna tombol
            editButton.classList.replace('hover:bg-blue-600', 'hover:bg-green-600');
            questionItem.classList.add('is-editing'); // Tambahkan class penanda mode edit
        }
    }

    // --- Fungsi Utilitas Error ---
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
        errorMessage.classList.add('p-3', 'bg-red-100', 'text-red-700', 'border', 'border-red-300', 'rounded-md'); // Styling error
    }
    function hideError() {
        errorMessage.classList.add('hidden');
        errorMessage.textContent = '';
        errorMessage.classList.remove('p-3', 'bg-red-100', 'text-red-700', 'border', 'border-red-300', 'rounded-md');
    }

    // --- Event Listener Tombol Aksi Global (Export & Save Changes) ---
    exportBtn.addEventListener('click', () => {
        if (!displayedQuestionsData || displayedQuestionsData.length === 0) {
            alert('Tidak ada soal untuk diekspor.');
            return;
        }
        let txtContent = "Daftar Soal (Generated by Kawanguru)\n";
        txtContent += "=========================================\n\n";
        const optionLetters = ['a', 'b', 'c', 'd', 'e', 'f'];

        // Gunakan data dari displayedQuestionsData yang mungkin sudah diedit
        displayedQuestionsData.forEach((question, index) => {
            // Ambil teks pertanyaan dari data
            txtContent += `${index + 1}. ${question.question_text}\n`; // Teks pertanyaan

            if (question.question_type === 'pilihan_ganda' && question.options && question.options.length > 0) {
                question.options.forEach((opt, optIndex) => {
                    const letter = optionLetters[optIndex] || String.fromCharCode(97 + optIndex);
                    // Pastikan ekspor pakai teks bersih
                    // Data di displayedQuestionsData seharusnya sudah bersih setelah disimpan dari mode edit
                    // Jika ragu, bisa gunakan cleanOptionText(opt) di sini
                    txtContent += `   ${letter}. ${opt}\n`; // Asumsi 'opt' di data sudah bersih
                });

                 // Cari jawaban benar pakai teks bersih dari data asli dan bandingkan dengan opsi bersih di data
                 const cleanedCorrectAnswer = cleanOptionText(question.correct_answer); // Bersihkan teks jawaban benar asli
                 // Cari di opsi yang ada di data (seharusnya sudah bersih)
                 const correctOptionIndex = question.options.findIndex(opt => opt === cleanedCorrectAnswer);

                 let correctAnswerInfo = "Jawaban Benar: (Tidak ditentukan atau tidak cocok)";
                 if (correctOptionIndex !== -1) {
                     correctAnswerInfo = `Jawaban Benar: ${optionLetters[correctOptionIndex] || String.fromCharCode(97 + correctOptionIndex)}`;
                 } else if (question.correct_answer){
                     // Fallback jika tidak cocok, tampilkan teks asli dari data
                     correctAnswerInfo = `Jawaban Benar (Teks Asli): ${question.correct_answer}`;
                 }
                txtContent += `   ${correctAnswerInfo}\n`; // Tambahkan info jawaban benar
            } else if (question.question_type === 'benar_salah' && question.correct_answer) {
                txtContent += `   Jawaban: ${question.correct_answer}\n`; // Jawaban untuk Benar/Salah
            } else if (question.question_type === 'isian_singkat' && question.correct_answer) {
                txtContent += `   Kunci Jawaban: ${question.correct_answer}\n`; // Kunci jawaban untuk Isian Singkat
            }
            // Tambahkan baris kosong antar soal
            txtContent += "\n";
        });

        // Buat file TXT dan trigger download
        const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // Format YYYYMMDD
        link.download = `kawanguru_soal_${timestamp}.txt`; // Nama file
        document.body.appendChild(link); // Tambahkan link ke body
        link.click(); // Klik link untuk download
        document.body.removeChild(link); // Hapus link dari body
        URL.revokeObjectURL(url); // Bebaskan memori
        console.log("Soal berhasil diekspor ke file TXT.");
        alert('Soal berhasil diekspor sebagai file TXT.');
    });

    saveChangesBtn.addEventListener('click', () => {
        // Placeholder: Implementasi logika untuk mengirim 'displayedQuestionsData' ke server
        // Contoh:
        /*
        fetch('/save-edited-questions', { // Ganti dengan endpoint Anda
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ questions: displayedQuestionsData }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Perubahan berhasil disimpan ke server!');
                console.log('Server response:', data);
            } else {
                alert('Gagal menyimpan perubahan ke server: ' + (data.message || 'Error tidak diketahui'));
            }
        })
        .catch(error => {
            console.error('Error saving changes:', error);
            alert('Terjadi kesalahan saat mencoba menyimpan perubahan.');
        });
        */
        alert('Fungsi Simpan Perubahan (ke server) belum diimplementasikan.\nData soal yang tersimpan di memori (termasuk editan) siap dikirim:\n' + JSON.stringify(displayedQuestionsData, null, 2));
        console.log("Data siap dikirim ke server:", displayedQuestionsData);
    });

}); // Akhir dari DOMContentLoaded
