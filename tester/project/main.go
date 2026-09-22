package main

import (
	"fmt"
	"os"
	"strconv"
)

func calculateBMI(weightKg float64, heightCm float64) float64 {
	if heightCm <= 0 {
		return 0
	}
	heightM := heightCm / 100.0
	return weightKg / (heightM * heightM)
}

func categoryBMI(bmi float64) string {
	switch {
	case bmi < 18.5:
		return "Underweight"
	case bmi < 25.0:
		return "Normal"
	case bmi < 30.0:
		return "Overweight"
	default:
		return "Obese"
	}
}

func main() {
	if len(os.Args) < 3 {
		fmt.Println("Usage: go run main.go <berat_kg> <tinggi_cm>")
		os.Exit(1)
	}

	weight, err1 := strconv.ParseFloat(os.Args[1], 64)
	height, err2 := strconv.ParseFloat(os.Args[2], 64)

	if err1 != nil || err2 != nil || weight <= 0 || height <= 0 {
		fmt.Println("Error: Berat dan tinggi harus angka positif.")
		os.Exit(1)
	}

	bmi := calculateBMI(weight, height)
	cat := categoryBMI(bmi)

	fmt.Printf("BMI: %.2f (%s)\n", bmi, cat)
}
