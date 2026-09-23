def hitung_bmi(berat, tinggi):
    if berat <= 0 or tinggi <= 0:
        raise ValueError("Berat dan tinggi harus positif")
    bmi = berat / ((tinggi / 100) ** 2)
    return bmi

def kategori_bmi(bmi):
    if bmi < 18.5:
        return "Underweight"
    elif bmi < 25:
        return "Normal"
    elif bmi < 30:
        return "Overweight"
    else:
        return "Obese"

if __name__ == "__main__":
    test_cases = [
        (65, 170, "Normal"),
        (45, 170, "Underweight"),
        (85, 170, "Overweight"),
        (100, 170, "Obese"),
    ]
    for berat, tinggi, expected in test_cases:
        bmi = hitung_bmi(berat, tinggi)
        kategori = kategori_bmi(bmi)
        assert kategori == expected, f"Gagal: {berat}kg/{tinggi}cm -> {kategori}"
        print(f"BMI {berat}kg/{tinggi}cm: {bmi:.1f} ({kategori})")
    print("Semua test berhasil.")
    # Edge case: berat atau tinggi tidak positif
    try:
        hitung_bmi(0, 170)
        print("ERROR: seharusnya error untuk berat 0")
    except ValueError as e:
        print("Edge case berat 0 ok:", e)
    try:
        hitung_bmi(-10, 170)
        print("ERROR: seharusnya error untuk berat negatif")
    except ValueError as e:
        print("Edge case berat negatif ok:", e)
