/* კონვერტის მთავარი კონტეინერი */
#inbox-wrapper {
    position: fixed !important;
    bottom: 30px !important; /* კომპიუტერისთვის */
    right: 80px !important;
    width: 55px !important;
    height: 55px !important;
    z-index: 99999 !important;
    cursor: pointer !important;
}

/* სპეციალურად მობილურებისთვის (ეკრანი < 600px) */
@media screen and (max-width: 600px) {
    #inbox-wrapper {
        bottom: 90px !important; /* აქ ავიყვანეთ მაღლა, რომ საწერ ზოლს არ დაედოს */
        right: 20px !important;  /* მობილურზე ცოტა მარჯვნივ იყოს */
    }
}
